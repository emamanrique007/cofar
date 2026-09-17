alter table "public"."ticket_agents" drop constraint "ticket_agents_working_days_check";

alter table "public"."ticket_agents" add constraint "ticket_agents_working_days_check" CHECK ((((cardinality(working_days) >= 1) AND (cardinality(working_days) <= 7)) AND (working_days <@ '{0,1,2,3,4,5,6}'::smallint[]))) not valid;

alter table "public"."ticket_agents" validate constraint "ticket_agents_working_days_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.auto_assign_ticket(ticket uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;


