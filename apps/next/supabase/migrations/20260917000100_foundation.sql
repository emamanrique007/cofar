create schema if not exists extensions;
create extension if not exists pgmq;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create type public.job_status as enum ('queued', 'completed', 'failed');
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now()
);
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 100),
  created_at timestamptz not null default now()
);
create table public.users_by_accounts (
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  primary key (account_id, user_id)
);
create index users_by_accounts_user_idx on public.users_by_accounts(user_id);
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  request_id uuid not null,
  body text not null check (length(trim(body)) between 1 and 1000),
  status public.job_status not null default 'queued',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (account_id, request_id)
);
create index jobs_account_created_idx on public.jobs(account_id, created_at desc);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index notifications_account_idx on public.notifications(account_id);
create table public.audit_logs (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now()
);
create index audit_logs_account_idx on public.audit_logs(account_id, created_at desc);

create function public.is_account_member(target_account uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.users_by_accounts where account_id = target_account and user_id = (select auth.uid()));
$$;
revoke all on function public.is_account_member(uuid) from public, anon;
grant execute on function public.is_account_member(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.users_by_accounts enable row level security;
alter table public.jobs enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy accounts_read on public.accounts for select to authenticated using (public.is_account_member(id));
create policy memberships_read on public.users_by_accounts for select to authenticated using (user_id = (select auth.uid()));
create policy jobs_read on public.jobs for select to authenticated using (public.is_account_member(account_id));
create policy notifications_read on public.notifications for select to authenticated using (public.is_account_member(account_id));
create policy audit_read on public.audit_logs for select to authenticated using (public.is_account_member(account_id));
revoke all on public.profiles, public.accounts, public.users_by_accounts, public.jobs, public.notifications, public.audit_logs from anon, authenticated;
grant select on public.profiles, public.accounts, public.users_by_accounts, public.jobs, public.notifications, public.audit_logs to authenticated;
grant update(name) on public.profiles to authenticated;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, name) values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

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

select pgmq.create('cofar_jobs');
select pgmq.create('cofar_jobs_dlq');
-- Queue internals are never exposed through PostgREST or browser roles.
revoke all on schema pgmq from public, anon, authenticated;
revoke all on all tables in schema pgmq from public, anon, authenticated;
revoke all on all functions in schema pgmq from public, anon, authenticated;

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

-- Storage is private and bound to an account folder: <account UUID>/<file>.
insert into storage.buckets(id, name, public, file_size_limit) values ('cofar-files', 'cofar-files', false, 20971520);
create policy files_read on storage.objects for select to authenticated
using (bucket_id = 'cofar-files' and (storage.foldername(name))[1] in (select account_id::text from public.users_by_accounts where user_id = (select auth.uid())));
create policy files_insert on storage.objects for insert to authenticated
with check (bucket_id = 'cofar-files' and (storage.foldername(name))[1] in (select account_id::text from public.users_by_accounts where user_id = (select auth.uid())));
create policy files_delete on storage.objects for delete to authenticated
using (bucket_id = 'cofar-files' and (storage.foldername(name))[1] in (select account_id::text from public.users_by_accounts where user_id = (select auth.uid())));
alter publication supabase_realtime add table public.jobs, public.notifications;
