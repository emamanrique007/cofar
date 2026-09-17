begin;
create extension if not exists pgtap with schema extensions;
select plan(12);
-- Agent ids are ordered on purpose: with everything else equal the routing
-- tiebreaker is the user id, so the expected agent is predictable here.
insert into auth.users(id, email) values
  ('00000000-0000-4000-8000-0000000000b1', 'first-agent@cofar.test'),
  ('00000000-0000-4000-8000-0000000000b2', 'second-agent@cofar.test'),
  ('00000000-0000-4000-8000-0000000000b3', 'asks@cofar.test');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b1', true);
select public.create_account('Reparto', 'UTC') as account_id \gset
select public.invite_account_member(:'account_id', 'second-agent@cofar.test', true, 'UTC');
select public.invite_account_member(:'account_id', 'asks@cofar.test', false, 'UTC');

-- Both agents are on shift every day, with room for two tickets each.
reset role;
update public.ticket_agents set working_days = '{0,1,2,3,4,5,6}', workday_start = '00:00',
  workday_end = '23:59', max_open_tickets = 2 where account_id = :'account_id';
set local role authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b3', true);
select id as access_id from public.ticket_categories where account_id = :'account_id' and slug = 'accesos' \gset
select id as gear_id from public.ticket_categories where account_id = :'account_id' and slug = 'equipos' \gset
select public.create_ticket(:'account_id', 'Primer pedido de acceso', 'No puedo entrar al sistema de ventas', :'access_id') ->> 'ticket_id' as first_id \gset
select public.create_ticket(:'account_id', 'Segundo pedido de acceso', 'Necesito acceso a la carpeta compartida', :'access_id') ->> 'ticket_id' as second_id \gset
select public.create_ticket(:'account_id', 'Tercer pedido de acceso', 'Me quedo sin permisos en el sistema', :'access_id') ->> 'ticket_id' as third_id \gset
select public.create_ticket(:'account_id', 'Cuarto pedido de acceso', 'Se bloqueo el usuario de mi companera', :'access_id') ->> 'ticket_id' as fourth_id \gset
select public.create_ticket(:'account_id', 'Quinto pedido de acceso', 'Quiero revisar los permisos de la carpeta', :'access_id') ->> 'ticket_id' as fifth_id \gset
select public.create_ticket(:'account_id', 'Monitor sin senal', 'El monitor del puesto tres no da imagen', :'gear_id') ->> 'ticket_id' as gear_ticket_id \gset

reset role;
select is(public.auto_assign_ticket(:'first_id'), '00000000-0000-4000-8000-0000000000b1'::uuid, 'the first ticket goes to the first idle agent');
select is(public.auto_assign_ticket(:'second_id'), '00000000-0000-4000-8000-0000000000b2'::uuid, 'the next one goes to the colleague with an empty desk');
select is(public.auto_assign_ticket(:'third_id'), '00000000-0000-4000-8000-0000000000b1'::uuid, 'with the same load it goes to whoever waited longest');
select is(public.auto_assign_ticket(:'fourth_id'), '00000000-0000-4000-8000-0000000000b2'::uuid, 'the work stays split evenly between both agents');
select is(public.auto_assign_ticket(:'fifth_id'), null, 'with every agent at their cap the ticket stays in the queue');
select is((select status::text from public.tickets where id = :'fifth_id'), 'new', 'a ticket nobody can take is left untouched');
select is((select count(*) from public.ticket_events where ticket_id = :'fifth_id'), 1::bigint, 'a failed routing attempt writes no events');

-- One agent frees a slot: the queued ticket is routed on the next run.
update public.tickets set status = 'resolved', resolved_at = now() where id = :'first_id';
select is(public.auto_assign_ticket(:'fifth_id'), '00000000-0000-4000-8000-0000000000b1'::uuid, 'the ticket waits until somebody has room again');

-- Coverage wins over load: with both agents free, only one takes hardware.
update public.tickets set status = 'resolved', resolved_at = now()
  where account_id = :'account_id' and id <> :'gear_ticket_id';
update public.ticket_agents set category_ids = array[:'access_id'::uuid]
  where account_id = :'account_id' and user_id = '00000000-0000-4000-8000-0000000000b2';
select is(public.auto_assign_ticket(:'gear_ticket_id'), '00000000-0000-4000-8000-0000000000b1'::uuid, 'a category nobody else covers goes to the agent who covers it');

-- Metrics answer the same numbers the table holds.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b1', true);
select public.ticket_metrics(:'account_id') as metrics \gset
select is(((:'metrics'::jsonb) ->> 'open')::integer, (select count(*)::integer from public.tickets where account_id = :'account_id' and status in ('new', 'assigned', 'in_progress')), 'metrics count the same open tickets as the table');
select is(((:'metrics'::jsonb) ->> 'unassigned')::integer, (select count(*)::integer from public.tickets where account_id = :'account_id' and status = 'new' and assignee_id is null), 'metrics count the same unassigned tickets as the table');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b3', true);
select is((select count(*) from public.tickets), 6::bigint, 'the requester still sees only the tickets they opened');
select * from finish();
rollback;
