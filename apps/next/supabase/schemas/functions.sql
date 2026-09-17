create function public.is_account_member(target_account uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.users_by_accounts where account_id = target_account and user_id = (select auth.uid()));
$$;
revoke all on function public.is_account_member(uuid) from public, anon;
grant execute on function public.is_account_member(uuid) to authenticated;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, name) values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create function public.create_account(account_name text) returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.accounts(name) values (trim(account_name)) returning id into result;
  insert into public.users_by_accounts(account_id, user_id, role) values (result, auth.uid(), 'owner');
  insert into public.audit_logs(account_id, actor_id, action, entity_id) values (result, auth.uid(), 'account.created', result);
  return result;
end;
$$;
revoke all on function public.create_account(text) from public, anon;
grant execute on function public.create_account(text) to authenticated;

create function public.enqueue_job(target_account uuid, request_key uuid, body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if not public.is_account_member(target_account) then raise exception 'Account access denied' using errcode = '42501'; end if;
  insert into public.jobs(account_id, created_by, request_id, body)
    values (target_account, auth.uid(), request_key, trim(body))
    on conflict (account_id, request_id) do nothing returning id into result;
  if result is null then
    select id into result from public.jobs where account_id = target_account and request_id = request_key;
    return result;
  end if;
  perform pgmq.send('cofar_jobs', jsonb_build_object('job_id', result));
  insert into public.audit_logs(account_id, actor_id, action, entity_id) values (target_account, auth.uid(), 'job.enqueued', result);
  return result;
end;
$$;
revoke all on function public.enqueue_job(uuid, uuid, text) from public, anon;
grant execute on function public.enqueue_job(uuid, uuid, text) to authenticated;

create function public.read_jobs(batch_size integer default 10)
returns table(msg_id bigint, read_ct integer, message jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  if batch_size is null or batch_size not between 1 and 20 then raise exception 'Invalid batch size'; end if;
  return query select r.msg_id, r.read_ct, r.message from pgmq.read('cofar_jobs', 120, batch_size) r;
end;
$$;

-- Receipt (read_ct) fences stale workers after a visibility lease expires.
-- Notification, job state and acknowledgement commit in one transaction.
create function public.complete_job(message_id bigint, receipt integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare item record; work public.jobs;
begin
  select * into item from pgmq.q_cofar_jobs where msg_id = message_id and read_ct = receipt and vt > clock_timestamp() for update;
  if not found then return false; end if;
  select * into work from public.jobs where id = (item.message->>'job_id')::uuid for update;
  if not found then raise exception 'Unknown job'; end if;
  if work.status = 'queued' then
    insert into public.notifications(job_id, account_id, body) values (work.id, work.account_id, work.body) on conflict (job_id) do nothing;
    update public.jobs set status = 'completed', attempts = receipt, completed_at = now(), last_error = null where id = work.id;
    insert into public.audit_logs(account_id, action, entity_id) values (work.account_id, 'job.completed', work.id);
  end if;
  perform pgmq.archive('cofar_jobs', message_id);
  return true;
end;
$$;

create function public.fail_job(message_id bigint, receipt integer, reason text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare item record; job_id uuid;
begin
  select * into item from pgmq.q_cofar_jobs where msg_id = message_id and read_ct = receipt and vt > clock_timestamp() for update;
  if not found then return false; end if;
  begin job_id := (item.message->>'job_id')::uuid; exception when invalid_text_representation then job_id := null; end;
  update public.jobs set attempts = receipt, last_error = left(reason, 1000) where id = job_id and status = 'queued';
  if receipt >= 5 then
    perform pgmq.send('cofar_jobs_dlq', jsonb_build_object('message', item.message, 'original_msg_id', message_id, 'reason', left(reason, 1000), 'failed_at', now()));
    update public.jobs set status = 'failed' where id = job_id and status = 'queued';
    perform pgmq.archive('cofar_jobs', message_id);
  else
    perform pgmq.set_vt('cofar_jobs', message_id, least(300, power(2, receipt)::integer));
  end if;
  return true;
end;
$$;
revoke all on function public.read_jobs(integer), public.complete_job(bigint, integer), public.fail_job(bigint, integer, text) from public, anon, authenticated;
grant execute on function public.read_jobs(integer), public.complete_job(bigint, integer), public.fail_job(bigint, integer, text) to service_role;
