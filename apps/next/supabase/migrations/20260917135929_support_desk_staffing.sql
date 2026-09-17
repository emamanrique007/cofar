alter table "public"."ticket_agents" drop constraint "ticket_agents_working_days_check";

drop function if exists "public"."create_ticket"(target_account uuid, ticket_title text, ticket_description text, category uuid, source public.ticket_category_source, confidence numeric, evidence jsonb);

alter table "public"."ticket_agents" add constraint "ticket_agents_working_days_check" CHECK ((((cardinality(working_days) >= 1) AND (cardinality(working_days) <= 7)) AND (working_days <@ '{0,1,2,3,4,5,6}'::smallint[]))) not valid;

alter table "public"."ticket_agents" validate constraint "ticket_agents_working_days_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.configure_support_agent(target_account uuid, member uuid, agent_timezone text, days smallint[], day_start time without time zone, day_end time without time zone, max_open integer, auto boolean, categories uuid[] DEFAULT '{}'::uuid[])
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_ticket(target_account uuid, ticket_title text, ticket_description text, category uuid DEFAULT NULL::uuid, source public.ticket_category_source DEFAULT 'requester'::public.ticket_category_source, confidence numeric DEFAULT NULL::numeric, evidence jsonb DEFAULT '{}'::jsonb, suggested uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;


-- The schema diff does not emit function privileges; these mirror functions.sql.
revoke all on function public.create_ticket(uuid, text, text, uuid, public.ticket_category_source, numeric, jsonb, uuid) from public, anon;
grant execute on function public.create_ticket(uuid, text, text, uuid, public.ticket_category_source, numeric, jsonb, uuid) to authenticated;
revoke all on function public.configure_support_agent(uuid, uuid, text, smallint[], time, time, integer, boolean, uuid[]) from public, anon;
grant execute on function public.configure_support_agent(uuid, uuid, text, smallint[], time, time, integer, boolean, uuid[]) to authenticated;
