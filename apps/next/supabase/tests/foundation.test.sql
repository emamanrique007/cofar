begin;
create extension if not exists pgtap with schema extensions;
select plan(18);
insert into auth.users(id, email) values ('00000000-0000-4000-8000-000000000001', 'first@example.test'), ('00000000-0000-4000-8000-000000000002', 'second@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select public.create_account('First account') as account_id \gset
select public.enqueue_job(:'account_id', '10000000-0000-4000-8000-000000000001', 'Hello') as job_id \gset
select is(public.enqueue_job(:'account_id', '10000000-0000-4000-8000-000000000001', 'Hello'), :'job_id'::uuid, 'enqueue is idempotent');
select is((select count(*) from public.accounts), 1::bigint, 'member reads own account');
select is((select count(*) from public.jobs), 1::bigint, 'member reads own job');
select throws_ok('select * from public.read_jobs(1)', '42501', null, 'user cannot consume queue');
select throws_ok('update public.jobs set status = ''completed''', '42501', null, 'user cannot forge completion');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.accounts), 0::bigint, 'other user cannot see account');
select is((select count(*) from public.jobs), 0::bigint, 'other user cannot see job');
select throws_ok(format('select public.enqueue_job(%L, %L, %L)', :'account_id', '10000000-0000-4000-8000-000000000002', 'Denied'), '42501', 'Account access denied', 'cannot enqueue for other account');
reset role;
select is((select count(*) from pgmq.q_cofar_jobs), 1::bigint, 'exactly one queue message');
select msg_id, read_ct from public.read_jobs(1) \gset
select is((select count(*) from public.read_jobs(1)), 0::bigint, 'visibility lease hides work from concurrent consumer');
select is(public.complete_job(:msg_id, :read_ct + 1), false, 'stale receipt cannot acknowledge');
select is(public.complete_job(:msg_id, :read_ct), true, 'work is acknowledged');
select is(public.complete_job(:msg_id, :read_ct), false, 'duplicate acknowledgement is harmless');
select is((select count(*) from public.notifications), 1::bigint, 'one notification effect');
select is((select status::text from public.jobs where id = :'job_id'), 'completed', 'job completed');
select pgmq.send('cofar_jobs', '{"job_id":"invalid"}'::jsonb) as poison_id \gset
select * from public.read_jobs(1);
select public.fail_job(:poison_id, 1, 'Invalid payload');
select is((select count(*) from pgmq.q_cofar_jobs where msg_id = :poison_id and vt > now()), 1::bigint, 'failed work retained with retry delay');
update pgmq.q_cofar_jobs set read_ct = 5, vt = now() + interval '120 seconds' where msg_id = :poison_id;
select public.fail_job(:poison_id, 5, 'Invalid payload');
select is((select count(*) from pgmq.q_cofar_jobs_dlq), 1::bigint, 'exhausted poison message enters DLQ');
select is((select count(*) from pgmq.q_cofar_jobs), 0::bigint, 'source archived only after DLQ write');
select * from finish();
rollback;
