begin;
create extension if not exists pgtap with schema extensions;
select plan(28);
insert into auth.users(id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'owner@cofar.test'),
  ('00000000-0000-4000-8000-0000000000a2', 'agent@cofar.test'),
  ('00000000-0000-4000-8000-0000000000a3', 'requester@cofar.test'),
  ('00000000-0000-4000-8000-0000000000a4', 'outsider@cofar.test');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
select public.create_account('Soporte', 'UTC') as account_id \gset
select public.invite_account_member(:'account_id', 'agent@cofar.test', true, 'UTC') as agent_id \gset
select public.invite_account_member(:'account_id', 'requester@cofar.test', false, 'UTC') as requester_id \gset
select is((select count(*) from public.ticket_categories where account_id = :'account_id'), 7::bigint, 'new workspace seeds its taxonomy');
select is((select count(*) from public.sla_policies where account_id = :'account_id'), 4::bigint, 'new workspace seeds one SLA target per priority');
select is((select count(*) from public.ticket_agents where account_id = :'account_id'), 2::bigint, 'creator and invited agent staff the desk');
select ok((select count(*) from public.ticket_category_rules where account_id = :'account_id') > 50, 'keyword rules are available to the classifier');

-- Agents are on shift every day so routing is deterministic in tests.
reset role;
update public.ticket_agents set working_days = '{0,1,2,3,4,5,6}', workday_start = '00:00', workday_end = '23:59' where account_id = :'account_id';
set local role authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a3', true);
select public.create_ticket(:'account_id', 'No puedo ingresar al sistema', 'Olvide mi clave y el usuario quedo bloqueado', (select id from public.ticket_categories where account_id = :'account_id' and slug = 'accesos'), 'auto', 0.82, '{"terms": ["clave"]}'::jsonb) ->> 'ticket_id' as ticket_id \gset
select is((select priority::text from public.tickets where id = :'ticket_id'), 'high', 'category default drives ticket priority');
select is((select count(*) from public.ticket_events where ticket_id = :'ticket_id'), 2::bigint, 'creation and classification are both recorded');
select ok((select first_response_due_at < resolution_due_at from public.tickets where id = :'ticket_id'), 'first response is promised before resolution');
select throws_ok(format('insert into public.tickets(account_id, requester_id, title, description, first_response_due_at, resolution_due_at) values (%L, %L, ''Directo'', ''Sin pasar por la RPC'', now(), now())', :'account_id', :'requester_id'), '42501', null, 'tickets cannot be written outside the RPC');
select throws_ok(format('update public.tickets set status = ''resolved'' where id = %L', :'ticket_id'), '42501', null, 'requesters cannot forge a resolution');
select throws_ok(format('select public.claim_ticket(%L)', :'ticket_id'), '42501', 'Agent access denied', 'requesters cannot take tickets');
select throws_ok(format('select public.ticket_metrics(%L)', :'account_id'), '42501', 'Agent access denied', 'metrics are an agent view');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
select public.create_ticket(:'account_id', 'Monitor con lineas verticales', 'El monitor del puesto 12 muestra lineas y parpadea', null, 'requester', null, '{}'::jsonb) ->> 'ticket_id' as other_ticket_id \gset
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a3', true);
select is((select count(*) from public.tickets), 1::bigint, 'a requester only sees their own tickets');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a2', true);
select is((select count(*) from public.tickets), 2::bigint, 'an agent sees the whole account queue');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a4', true);
select is((select count(*) from public.tickets), 0::bigint, 'another account sees nothing');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a2', true);
select is(public.claim_ticket(:'ticket_id'), true, 'an agent takes a ticket from the queue');
select is(public.claim_ticket(:'ticket_id'), false, 'a ticket already taken cannot be taken twice');
select ok((select first_responded_at is not null from public.tickets where id = :'ticket_id'), 'taking a ticket stops the first response clock');
select throws_ok(format('select public.set_ticket_status(%L, ''closed'')', :'ticket_id'), '22023', 'Invalid ticket transition', 'closing skips no step');
select is(public.set_ticket_status(:'ticket_id', 'resolved'), true, 'an agent resolves the ticket');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a3', true);
select is(public.set_ticket_status(:'ticket_id', 'closed'), true, 'the requester confirms the resolution');

-- Routing and SLA sweep run with the service role, never with a user session.
reset role;
select is(public.auto_assign_ticket(:'other_ticket_id'), '00000000-0000-4000-8000-0000000000a1'::uuid, 'routing picks the agent idle for longest');
update public.tickets set assignee_id = null, status = 'new' where id = :'other_ticket_id';
update public.ticket_agents set working_days = array[((extract(dow from now())::integer + 3) % 7)::smallint] where account_id = :'account_id';
select is(public.auto_assign_ticket(:'other_ticket_id'), null, 'nobody on shift leaves the ticket in the queue');
update public.ticket_agents set working_days = '{0,1,2,3,4,5,6}' where account_id = :'account_id';
update public.ticket_agents set max_open_tickets = 1 where account_id = :'account_id';
update public.tickets set status = 'assigned', assignee_id = '00000000-0000-4000-8000-0000000000a1' where id = :'ticket_id';
update public.tickets set assignee_id = null, status = 'new' where id = :'other_ticket_id';
select is(public.auto_assign_ticket(:'other_ticket_id'), '00000000-0000-4000-8000-0000000000a2'::uuid, 'an agent at their load cap is skipped');
update public.tickets set assignee_id = null, status = 'new', first_response_due_at = now() - interval '1 hour', resolution_due_at = now() - interval '1 hour', first_responded_at = null, resolved_at = null where id = :'other_ticket_id';
select is((select first_response from public.sweep_ticket_sla(200)), 1, 'the sweep marks the overdue first response');
select is((select first_response from public.sweep_ticket_sla(200)), 0, 'the sweep does not report the same breach twice');
select is((select count(*) from public.ticket_events where ticket_id = :'other_ticket_id' and type = 'sla_breached'), 2::bigint, 'each breached target is written to the trail');
select is(public.support_coverage_deadline(:'account_id', '2026-09-19 12:00:00+00'::timestamptz, 60), '2026-09-19 13:00:00+00'::timestamptz, 'coverage follows the union of agent shifts');
delete from public.ticket_agents where account_id = :'account_id';
select is(public.support_coverage_deadline(:'account_id', '2026-09-19 12:00:00+00'::timestamptz, 60), '2026-09-19 13:00:00+00'::timestamptz, 'a desk without agents falls back to elapsed time');
select * from finish();
rollback;
