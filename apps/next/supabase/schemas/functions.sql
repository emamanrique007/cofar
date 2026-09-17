create function public.is_account_member(target_account uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.users_by_accounts where account_id = target_account and user_id = (select auth.uid()));
$$;
revoke all on function public.is_account_member(uuid) from public, anon;
grant execute on function public.is_account_member(uuid) to authenticated;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, name, email) values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), coalesce(new.email, ''));
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create function public.safe_timezone(candidate text) returns text
language plpgsql stable set search_path = '' as $$
declare result text := coalesce(nullif(trim(candidate), ''), 'UTC');
begin
  perform timestamptz '2000-01-01 00:00:00Z' at time zone result;
  return result;
exception when others then
  return 'UTC';
end;
$$;
revoke all on function public.safe_timezone(text) from public, anon, authenticated;

-- Default taxonomy, keyword rules and SLA targets for a new workspace.
create function public.seed_support_desk(target_account uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.ticket_categories(account_id, slug, name, default_priority, is_fallback) values
    (target_account, 'accesos', 'Accesos y contraseñas', 'high', false),
    (target_account, 'equipos', 'Equipos y hardware', 'normal', false),
    (target_account, 'software', 'Software y licencias', 'normal', false),
    (target_account, 'red', 'Red y conectividad', 'high', false),
    (target_account, 'rrhh', 'Recursos humanos', 'normal', false),
    (target_account, 'compras', 'Compras y facturación', 'normal', false),
    (target_account, 'otros', 'Sin clasificar', 'normal', true);
  insert into public.ticket_category_rules(account_id, category_id, term, weight)
  select target_account, category.id, rule.term, rule.weight
  from (values
    ('accesos', 'contraseña', 5), ('accesos', 'password', 5), ('accesos', 'clave', 4),
    ('accesos', 'restablecer', 3), ('accesos', 'bloqueado', 4), ('accesos', 'bloqueada', 4),
    ('accesos', 'vpn', 5), ('accesos', 'acceso', 3), ('accesos', 'permisos', 3),
    ('accesos', 'login', 4), ('accesos', 'mfa', 5), ('accesos', 'doble factor', 6),
    ('accesos', 'no puedo ingresar', 6), ('accesos', 'usuario bloqueado', 6),
    ('equipos', 'notebook', 5), ('equipos', 'laptop', 5), ('equipos', 'computadora', 4),
    ('equipos', 'monitor', 5), ('equipos', 'teclado', 5), ('equipos', 'mouse', 5),
    ('equipos', 'impresora', 5), ('equipos', 'escaner', 4), ('equipos', 'cargador', 4),
    ('equipos', 'bateria', 4), ('equipos', 'pantalla', 4), ('equipos', 'auriculares', 4),
    ('equipos', 'no enciende', 6), ('equipos', 'equipo', 2),
    ('software', 'instalar', 4), ('software', 'instalacion', 4), ('software', 'licencia', 4),
    ('software', 'office', 5), ('software', 'excel', 5), ('software', 'word', 4),
    ('software', 'outlook', 5), ('software', 'actualizacion', 3), ('software', 'programa', 3),
    ('software', 'aplicacion', 3), ('software', 'sistema', 2), ('software', 'se cierra', 4),
    ('red', 'internet', 5), ('red', 'wifi', 5), ('red', 'red', 3), ('red', 'conexion', 4),
    ('red', 'conectividad', 5), ('red', 'lento', 3), ('red', 'caida', 4), ('red', 'cable', 3),
    ('red', 'router', 5), ('red', 'señal', 3), ('red', 'intermitente', 4), ('red', 'sin internet', 6),
    ('rrhh', 'vacaciones', 5), ('rrhh', 'licencia medica', 7), ('rrhh', 'recibo', 4),
    ('rrhh', 'recibo de sueldo', 7), ('rrhh', 'sueldo', 5), ('rrhh', 'haberes', 5),
    ('rrhh', 'ausencia', 4), ('rrhh', 'certificado', 4), ('rrhh', 'legajo', 5),
    ('rrhh', 'aguinaldo', 5), ('rrhh', 'obra social', 6), ('rrhh', 'recursos humanos', 6),
    ('compras', 'factura', 5), ('compras', 'facturacion', 5), ('compras', 'pago', 4),
    ('compras', 'proveedor', 5), ('compras', 'compra', 4), ('compras', 'presupuesto', 4),
    ('compras', 'orden de compra', 7), ('compras', 'reembolso', 5), ('compras', 'viaticos', 5),
    ('compras', 'remito', 5), ('compras', 'cotizacion', 4)
  ) as rule(slug, term, weight)
  join public.ticket_categories category
    on category.account_id = target_account and category.slug = rule.slug;
  insert into public.sla_policies(account_id, priority, first_response_minutes, resolution_minutes) values
    (target_account, 'urgent', 30, 240),
    (target_account, 'high', 60, 480),
    (target_account, 'normal', 240, 1440),
    (target_account, 'low', 480, 2400);
end;
$$;
revoke all on function public.seed_support_desk(uuid) from public, anon, authenticated;

create function public.create_account(account_name text, agent_timezone text default 'UTC') returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.accounts(name) values (trim(account_name)) returning id into result;
  insert into public.users_by_accounts(account_id, user_id, role) values (result, auth.uid(), 'owner');
  insert into public.audit_logs(account_id, actor_id, action, entity_id) values (result, auth.uid(), 'account.created', result);
  perform public.seed_support_desk(result);
  -- The person who opens the workspace is its first support agent.
  insert into public.ticket_agents(account_id, user_id, timezone)
    values (result, auth.uid(), public.safe_timezone(agent_timezone));
  return result;
end;
$$;
revoke all on function public.create_account(text, text) from public, anon;
grant execute on function public.create_account(text, text) to authenticated;

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

create function public.is_ticket_agent(target_account uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.ticket_agents where account_id = target_account and user_id = (select auth.uid()));
$$;
revoke all on function public.is_ticket_agent(uuid) from public, anon;
grant execute on function public.is_ticket_agent(uuid) to authenticated;

-- SLA clock. Working hours belong to each agent, so the team's coverage is the
-- union of its agents' shifts; an account with no agents falls back to elapsed time.
create function public.support_coverage_deadline(target_account uuid, start_at timestamptz, minutes integer)
returns timestamptz language plpgsql stable security definer set search_path = '' as $$
declare
  horizon integer;
  remaining integer;
  span record;
  window_start timestamptz;
  available integer;
  last_end timestamptz := start_at;
begin
  if minutes is null or minutes < 0 then raise exception 'Invalid SLA minutes' using errcode = '22023'; end if;
  remaining := minutes;
  horizon := least(365, greatest(7, (minutes / 240) + 7));
  for span in
    with shifts as (
      select tstzrange((day + agent.workday_start) at time zone agent.timezone, (day + agent.workday_end) at time zone agent.timezone) as slot
      from public.ticket_agents agent
      cross join lateral generate_series(
        date_trunc('day', start_at at time zone agent.timezone) - interval '1 day',
        date_trunc('day', start_at at time zone agent.timezone) + make_interval(days => horizon),
        interval '1 day'
      ) as day
      where agent.account_id = target_account
        and extract(dow from day)::smallint = any(agent.working_days)
    ),
    ordered as (
      select lower(slot) as slot_start, upper(slot) as slot_end,
        max(upper(slot)) over (order by lower(slot) rows between unbounded preceding and 1 preceding) as previous_end
      from shifts where upper(slot) > start_at
    ),
    islands as (
      select slot_start, slot_end,
        count(*) filter (where previous_end is null or slot_start > previous_end)
          over (order by slot_start rows between unbounded preceding and current row) as island
      from ordered
    )
    select min(slot_start) as slot_start, max(slot_end) as slot_end from islands group by island order by 1
  loop
    window_start := greatest(span.slot_start, start_at);
    last_end := span.slot_end;
    if span.slot_end > window_start then
      available := floor(extract(epoch from (span.slot_end - window_start)) / 60)::integer;
      if available >= remaining then return window_start + make_interval(mins => remaining); end if;
      remaining := remaining - available;
    end if;
  end loop;
  return greatest(last_end, start_at) + make_interval(mins => remaining);
end;
$$;
revoke all on function public.support_coverage_deadline(uuid, timestamptz, integer) from public, anon;
grant execute on function public.support_coverage_deadline(uuid, timestamptz, integer) to authenticated;

-- Category drives priority and priority drives the SLA targets.
create function public.create_ticket(
  target_account uuid,
  ticket_title text,
  ticket_description text,
  category uuid default null,
  source public.ticket_category_source default 'requester',
  confidence numeric default null,
  evidence jsonb default '{}'::jsonb,
  suggested uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  chosen public.ticket_categories;
  policy public.sla_policies;
  ticket_priority public.ticket_priority;
  created public.tickets;
  suggested_slug text;
  opened_at timestamptz := now();
begin
  if not public.is_account_member(target_account) then raise exception 'Account access denied' using errcode = '42501'; end if;
  if category is not null then
    select * into chosen from public.ticket_categories where id = category and account_id = target_account and active;
  end if;
  if chosen.id is null then
    select * into chosen from public.ticket_categories where account_id = target_account and is_fallback;
  end if;
  ticket_priority := coalesce(chosen.default_priority, 'normal');
  select * into policy from public.sla_policies where account_id = target_account and priority = ticket_priority;
  insert into public.tickets(account_id, requester_id, category_id, category_source, category_confidence, title, description, priority, first_response_due_at, resolution_due_at)
  values (
    target_account, auth.uid(), chosen.id, source, confidence, trim(ticket_title), trim(ticket_description), ticket_priority,
    public.support_coverage_deadline(target_account, opened_at, coalesce(policy.first_response_minutes, 240)),
    public.support_coverage_deadline(target_account, opened_at, coalesce(policy.resolution_minutes, 1440))
  ) returning * into created;
  insert into public.ticket_events(account_id, ticket_id, actor_id, type, to_value, detail)
  values (target_account, created.id, auth.uid(), 'created', 'new', jsonb_build_object('priority', ticket_priority, 'category', chosen.slug));
  if source <> 'requester' then
    insert into public.ticket_events(account_id, ticket_id, actor_id, type, to_value, detail)
    values (target_account, created.id, auth.uid(), 'classified', chosen.slug, jsonb_build_object('confidence', confidence, 'evidence', coalesce(evidence, '{}'::jsonb), 'agrees', true));
  elsif suggested is not null and suggested is distinct from chosen.id then
    -- The requester chose, the rules disagreed: the agent decides who was right.
    select slug into suggested_slug from public.ticket_categories where id = suggested and account_id = target_account;
    insert into public.ticket_events(account_id, ticket_id, actor_id, type, from_value, to_value, detail)
    values (target_account, created.id, auth.uid(), 'classified', chosen.slug, suggested_slug, jsonb_build_object('confidence', confidence, 'evidence', coalesce(evidence, '{}'::jsonb), 'agrees', false));
  end if;
  insert into public.audit_logs(account_id, actor_id, action, entity_id) values (target_account, auth.uid(), 'ticket.created', created.id);
  -- The caller sees what was persisted, not what it proposed.
  return jsonb_build_object('ticket_id', created.id, 'number', created.number, 'category_id', chosen.id, 'category', chosen.name, 'priority', ticket_priority);
end;
$$;
revoke all on function public.create_ticket(uuid, text, text, uuid, public.ticket_category_source, numeric, jsonb, uuid) from public, anon;
grant execute on function public.create_ticket(uuid, text, text, uuid, public.ticket_category_source, numeric, jsonb, uuid) to authenticated;

-- Taking a ticket is the first human response; the lock makes two agents racing safe.
create function public.claim_ticket(ticket uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare work public.tickets;
begin
  select * into work from public.tickets where id = ticket for update;
  if not found then raise exception 'Unknown ticket' using errcode = '42501'; end if;
  if not public.is_ticket_agent(work.account_id) then raise exception 'Agent access denied' using errcode = '42501'; end if;
  if work.assignee_id is not null or work.status <> 'new' then return false; end if;
  update public.tickets set assignee_id = auth.uid(), status = 'assigned',
    first_responded_at = coalesce(first_responded_at, now()), updated_at = now()
  where id = work.id;
  update public.ticket_agents set last_assigned_at = now() where account_id = work.account_id and user_id = auth.uid();
  insert into public.ticket_events(account_id, ticket_id, actor_id, type, to_value, detail)
  values (work.account_id, work.id, auth.uid(), 'assigned', auth.uid()::text, jsonb_build_object('mode', 'self'));
  insert into public.ticket_events(account_id, ticket_id, actor_id, type, from_value, to_value)
  values (work.account_id, work.id, auth.uid(), 'status_changed', 'new', 'assigned');
  return true;
end;
$$;
revoke all on function public.claim_ticket(uuid) from public, anon;
grant execute on function public.claim_ticket(uuid) to authenticated;

create function public.set_ticket_status(ticket uuid, next_status public.ticket_status) returns boolean
language plpgsql security definer set search_path = '' as $$
declare work public.tickets; is_agent boolean; allowed boolean := false;
begin
  select * into work from public.tickets where id = ticket for update;
  if not found or not public.is_account_member(work.account_id) then raise exception 'Ticket access denied' using errcode = '42501'; end if;
  is_agent := public.is_ticket_agent(work.account_id);
  if not is_agent and work.requester_id <> auth.uid() then raise exception 'Ticket access denied' using errcode = '42501'; end if;
  if work.status = next_status then return false; end if;
  if is_agent then
    allowed := (work.status = 'assigned' and next_status in ('in_progress', 'resolved'))
      or (work.status = 'in_progress' and next_status = 'resolved')
      or (work.status = 'resolved' and next_status in ('closed', 'in_progress'));
  else
    -- The requester only confirms or reopens the resolution of their own ticket.
    allowed := work.requester_id = auth.uid() and work.status = 'resolved' and next_status in ('closed', 'in_progress');
  end if;
  if not allowed then raise exception 'Invalid ticket transition' using errcode = '22023'; end if;
  update public.tickets set status = next_status, updated_at = now(),
    first_responded_at = case when is_agent then coalesce(first_responded_at, now()) else first_responded_at end,
    resolved_at = case when next_status = 'resolved' then now() when next_status = 'in_progress' then null else resolved_at end,
    closed_at = case when next_status = 'closed' then now() else closed_at end
  where id = work.id;
  insert into public.ticket_events(account_id, ticket_id, actor_id, type, from_value, to_value)
  values (work.account_id, work.id, auth.uid(), 'status_changed', work.status::text, next_status::text);
  return true;
end;
$$;
revoke all on function public.set_ticket_status(uuid, public.ticket_status) from public, anon;
grant execute on function public.set_ticket_status(uuid, public.ticket_status) to authenticated;

-- Escalation keeps the original clock start: the promise is measured from creation.
create function public.set_ticket_priority(ticket uuid, next_priority public.ticket_priority) returns boolean
language plpgsql security definer set search_path = '' as $$
declare work public.tickets; policy public.sla_policies;
begin
  select * into work from public.tickets where id = ticket for update;
  if not found or not public.is_ticket_agent(work.account_id) then raise exception 'Agent access denied' using errcode = '42501'; end if;
  if work.priority = next_priority then return false; end if;
  select * into policy from public.sla_policies where account_id = work.account_id and priority = next_priority;
  update public.tickets set priority = next_priority, updated_at = now(),
    first_response_due_at = public.support_coverage_deadline(work.account_id, work.created_at, coalesce(policy.first_response_minutes, 240)),
    resolution_due_at = public.support_coverage_deadline(work.account_id, work.created_at, coalesce(policy.resolution_minutes, 1440)),
    first_response_breached_at = null, resolution_breached_at = null
  where id = work.id;
  insert into public.ticket_events(account_id, ticket_id, actor_id, type, from_value, to_value)
  values (work.account_id, work.id, auth.uid(), 'priority_changed', work.priority::text, next_priority::text);
  return true;
end;
$$;
revoke all on function public.set_ticket_priority(uuid, public.ticket_priority) from public, anon;
grant execute on function public.set_ticket_priority(uuid, public.ticket_priority) to authenticated;

-- Every correction of the rules engine is recorded as training evidence.
create function public.set_ticket_category(ticket uuid, category uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare work public.tickets; chosen public.ticket_categories; previous text;
begin
  select * into work from public.tickets where id = ticket for update;
  if not found or not public.is_ticket_agent(work.account_id) then raise exception 'Agent access denied' using errcode = '42501'; end if;
  select * into chosen from public.ticket_categories where id = category and account_id = work.account_id and active;
  if not found then raise exception 'Unknown ticket category' using errcode = '22023'; end if;
  if work.category_id = chosen.id then return false; end if;
  select slug into previous from public.ticket_categories where id = work.category_id;
  update public.tickets set category_id = chosen.id, category_source = 'agent', category_confidence = null, updated_at = now() where id = work.id;
  insert into public.ticket_events(account_id, ticket_id, actor_id, type, from_value, to_value, detail)
  values (work.account_id, work.id, auth.uid(), 'recategorized', previous, chosen.slug, jsonb_build_object('previous_source', work.category_source, 'previous_confidence', work.category_confidence));
  return true;
end;
$$;
revoke all on function public.set_ticket_category(uuid, uuid) from public, anon;
grant execute on function public.set_ticket_category(uuid, uuid) to authenticated;

create function public.ticket_metrics(target_account uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_ticket_agent(target_account) then raise exception 'Agent access denied' using errcode = '42501'; end if;
  select jsonb_build_object(
    'total', count(*),
    'open', count(*) filter (where status in ('new', 'assigned', 'in_progress')),
    'unassigned', count(*) filter (where status = 'new' and assignee_id is null),
    'mine', count(*) filter (where assignee_id = (select auth.uid()) and status in ('assigned', 'in_progress')),
    'overdue_first_response', count(*) filter (where first_responded_at is null and first_response_due_at < now() and status in ('new', 'assigned')),
    'overdue_resolution', count(*) filter (where resolved_at is null and resolution_due_at < now() and status in ('new', 'assigned', 'in_progress')),
    'first_response_total', count(*) filter (where first_responded_at is not null),
    'first_response_on_time', count(*) filter (where first_responded_at is not null and first_responded_at <= first_response_due_at),
    'resolution_total', count(*) filter (where resolved_at is not null),
    'resolution_on_time', count(*) filter (where resolved_at is not null and resolved_at <= resolution_due_at),
    'avg_resolution_hours', round(coalesce(avg(extract(epoch from (resolved_at - created_at)) / 3600) filter (where resolved_at is not null), 0)::numeric, 1),
    'auto_categorized', count(*) filter (where category_source = 'auto'),
    'agent_corrected', count(*) filter (where category_source = 'agent'),
    'by_status', (select coalesce(jsonb_object_agg(status::text, total), '{}'::jsonb) from (select status, count(*) as total from public.tickets where account_id = target_account group by status) rows),
    'by_priority', (select coalesce(jsonb_object_agg(priority::text, total), '{}'::jsonb) from (select priority, count(*) as total from public.tickets where account_id = target_account and status in ('new', 'assigned', 'in_progress') group by priority) rows),
    'by_category', (select coalesce(jsonb_object_agg(name, total), '{}'::jsonb) from (select category.name, count(*) as total from public.tickets ticket join public.ticket_categories category on category.id = ticket.category_id where ticket.account_id = target_account group by category.name) rows),
    'agents', (select count(*) from public.ticket_agents where account_id = target_account)
  ) into result from public.tickets where account_id = target_account;
  return result;
end;
$$;
revoke all on function public.ticket_metrics(uuid) from public, anon;
grant execute on function public.ticket_metrics(uuid) to authenticated;

create function public.invite_account_member(target_account uuid, member_email text, make_agent boolean default false, agent_timezone text default 'UTC')
returns uuid language plpgsql security definer set search_path = '' as $$
declare member uuid;
begin
  if not exists(select 1 from public.users_by_accounts where account_id = target_account and user_id = (select auth.uid()) and role = 'owner') then
    raise exception 'Owner access denied' using errcode = '42501';
  end if;
  select id into member from auth.users where lower(email) = lower(trim(member_email)) limit 1;
  if member is null then raise exception 'Unknown user' using errcode = '22023'; end if;
  insert into public.users_by_accounts(account_id, user_id, role) values (target_account, member, 'member') on conflict do nothing;
  if make_agent then
    insert into public.ticket_agents(account_id, user_id, timezone) values (target_account, member, public.safe_timezone(agent_timezone)) on conflict do nothing;
  end if;
  insert into public.audit_logs(account_id, actor_id, action, entity_id) values (target_account, (select auth.uid()), 'member.invited', member);
  return member;
end;
$$;
revoke all on function public.invite_account_member(uuid, text, boolean, text) from public, anon;
grant execute on function public.invite_account_member(uuid, text, boolean, text) to authenticated;

create function public.set_support_agent(target_account uuid, member uuid, enabled boolean, agent_timezone text default 'UTC')
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.users_by_accounts where account_id = target_account and user_id = (select auth.uid()) and role = 'owner') then
    raise exception 'Owner access denied' using errcode = '42501';
  end if;
  if not exists(select 1 from public.users_by_accounts where account_id = target_account and user_id = member) then
    raise exception 'User is not a member of this account' using errcode = '22023';
  end if;
  if enabled then
    insert into public.ticket_agents(account_id, user_id, timezone) values (target_account, member, public.safe_timezone(agent_timezone)) on conflict do nothing;
    return true;
  end if;
  if exists(select 1 from public.tickets where account_id = target_account and assignee_id = member and status in ('assigned', 'in_progress')) then
    raise exception 'Agent still has open tickets' using errcode = '22023';
  end if;
  delete from public.ticket_agents where account_id = target_account and user_id = member;
  return true;
end;
$$;
revoke all on function public.set_support_agent(uuid, uuid, boolean, text) from public, anon;
grant execute on function public.set_support_agent(uuid, uuid, boolean, text) to authenticated;

-- The owner staffs the desk: hires an agent and writes their whole shift at once.
create function public.configure_support_agent(
  target_account uuid,
  member uuid,
  agent_timezone text,
  days smallint[],
  day_start time,
  day_end time,
  max_open integer,
  auto boolean,
  categories uuid[] default '{}'::uuid[]
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.users_by_accounts where account_id = target_account and user_id = (select auth.uid()) and role = 'owner') then
    raise exception 'Owner access denied' using errcode = '42501';
  end if;
  if not exists(select 1 from public.users_by_accounts where account_id = target_account and user_id = member) then
    raise exception 'User is not a member of this account' using errcode = '22023';
  end if;
  if day_start >= day_end then raise exception 'Invalid working hours' using errcode = '22023'; end if;
  if exists(select target.id from unnest(categories) target(id) where not exists(
    select 1 from public.ticket_categories category where category.id = target.id and category.account_id = target_account
  )) then
    raise exception 'Unknown ticket category' using errcode = '22023';
  end if;
  insert into public.ticket_agents(account_id, user_id, timezone, working_days, workday_start, workday_end, max_open_tickets, auto_assign, category_ids)
  values (target_account, member, public.safe_timezone(agent_timezone), days, day_start, day_end, max_open, auto, categories)
  on conflict (account_id, user_id) do update set
    timezone = excluded.timezone, working_days = excluded.working_days,
    workday_start = excluded.workday_start, workday_end = excluded.workday_end,
    max_open_tickets = excluded.max_open_tickets, auto_assign = excluded.auto_assign,
    category_ids = excluded.category_ids;
  insert into public.audit_logs(account_id, actor_id, action, entity_id) values (target_account, (select auth.uid()), 'agent.configured', member);
  return true;
end;
$$;
revoke all on function public.configure_support_agent(uuid, uuid, text, smallint[], time, time, integer, boolean, uuid[]) from public, anon;
grant execute on function public.configure_support_agent(uuid, uuid, text, smallint[], time, time, integer, boolean, uuid[]) to authenticated;

-- Each agent owns their shift; the union of shifts is the team's SLA coverage.
create function public.update_agent_shift(
  target_account uuid,
  next_availability public.ticket_availability,
  agent_timezone text,
  days smallint[],
  day_start time,
  day_end time,
  max_open integer,
  auto boolean
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_ticket_agent(target_account) then raise exception 'Agent access denied' using errcode = '42501'; end if;
  if day_start >= day_end then raise exception 'Invalid working hours' using errcode = '22023'; end if;
  update public.ticket_agents set availability = next_availability, timezone = public.safe_timezone(agent_timezone),
    working_days = days, workday_start = day_start, workday_end = day_end,
    max_open_tickets = max_open, auto_assign = auto
  where account_id = target_account and user_id = (select auth.uid());
  return found;
end;
$$;
revoke all on function public.update_agent_shift(uuid, public.ticket_availability, text, smallint[], time, time, integer, boolean) from public, anon;
grant execute on function public.update_agent_shift(uuid, public.ticket_availability, text, smallint[], time, time, integer, boolean) to authenticated;

create function public.pending_ticket_assignments(batch integer default 25)
returns table(id uuid, account_id uuid, category_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if batch is null or batch not between 1 and 200 then raise exception 'Invalid batch size' using errcode = '22023'; end if;
  return query
    select ticket.id, ticket.account_id, ticket.category_id
    from public.tickets ticket
    where ticket.status = 'new' and ticket.assignee_id is null
      and exists(select 1 from public.ticket_agents agent where agent.account_id = ticket.account_id and agent.auto_assign)
    order by ticket.priority desc, ticket.created_at
    limit batch;
end;
$$;

-- Routing: available agent, on shift in their own timezone, under their load cap,
-- covering the ticket category. The queue goes to whoever is emptiest relative
-- to their own cap, so an agent with four open tickets does not get a fifth
-- while a colleague who covers the same category is free. Ties go to whoever
-- has been waiting longest for work, which keeps the rotation even.
create function public.auto_assign_ticket(ticket uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare work public.tickets; candidate uuid;
begin
  select * into work from public.tickets where id = ticket for update;
  if not found or work.status <> 'new' or work.assignee_id is not null then return null; end if;
  select agent.user_id into candidate
  from public.ticket_agents agent
  cross join lateral (
    select count(*) as open_tickets from public.tickets open_ticket
    where open_ticket.account_id = agent.account_id and open_ticket.assignee_id = agent.user_id
      and open_ticket.status in ('assigned', 'in_progress')
  ) workload
  where agent.account_id = work.account_id
    and agent.auto_assign
    and agent.availability = 'available'
    and (cardinality(agent.category_ids) = 0 or work.category_id = any(agent.category_ids))
    and extract(dow from (now() at time zone agent.timezone))::smallint = any(agent.working_days)
    and (now() at time zone agent.timezone)::time >= agent.workday_start
    and (now() at time zone agent.timezone)::time < agent.workday_end
    and workload.open_tickets < agent.max_open_tickets
  order by
    workload.open_tickets::numeric / greatest(agent.max_open_tickets, 1),
    agent.last_assigned_at nulls first,
    agent.user_id
  limit 1;
  if candidate is null then return null; end if;
  update public.tickets set assignee_id = candidate, status = 'assigned', updated_at = now() where id = work.id;
  update public.ticket_agents set last_assigned_at = now() where account_id = work.account_id and user_id = candidate;
  -- Routing is not a human answer: the first-response clock keeps running.
  insert into public.ticket_events(account_id, ticket_id, actor_id, type, to_value, detail)
  values (work.account_id, work.id, null, 'assigned', candidate::text, jsonb_build_object('mode', 'auto'));
  insert into public.ticket_events(account_id, ticket_id, actor_id, type, from_value, to_value)
  values (work.account_id, work.id, null, 'status_changed', 'new', 'assigned');
  return candidate;
end;
$$;

create function public.sweep_ticket_sla(batch integer default 200)
returns table(first_response integer, resolution integer)
language plpgsql security definer set search_path = '' as $$
declare late_first integer; late_resolution integer;
begin
  if batch is null or batch not between 1 and 500 then raise exception 'Invalid batch size' using errcode = '22023'; end if;
  with breached as (
    update public.tickets set first_response_breached_at = now(), updated_at = now()
    where id in (
      select ticket.id from public.tickets ticket
      where ticket.first_responded_at is null and ticket.first_response_breached_at is null
        and ticket.first_response_due_at < now() and ticket.status in ('new', 'assigned')
      order by ticket.first_response_due_at limit batch
    )
    returning id, account_id, priority
  )
  insert into public.ticket_events(account_id, ticket_id, type, to_value, detail)
  select account_id, id, 'sla_breached', 'first_response', jsonb_build_object('target', 'first_response', 'priority', priority) from breached;
  get diagnostics late_first = row_count;
  with breached as (
    update public.tickets set resolution_breached_at = now(), updated_at = now()
    where id in (
      select ticket.id from public.tickets ticket
      where ticket.resolved_at is null and ticket.resolution_breached_at is null
        and ticket.resolution_due_at < now() and ticket.status in ('new', 'assigned', 'in_progress')
      order by ticket.resolution_due_at limit batch
    )
    returning id, account_id, priority
  )
  insert into public.ticket_events(account_id, ticket_id, type, to_value, detail)
  select account_id, id, 'sla_breached', 'resolution', jsonb_build_object('target', 'resolution', 'priority', priority) from breached;
  get diagnostics late_resolution = row_count;
  return query select late_first, late_resolution;
end;
$$;
revoke all on function public.pending_ticket_assignments(integer), public.auto_assign_ticket(uuid), public.sweep_ticket_sla(integer) from public, anon, authenticated;
grant execute on function public.pending_ticket_assignments(integer), public.auto_assign_ticket(uuid), public.sweep_ticket_sla(integer) to service_role;
