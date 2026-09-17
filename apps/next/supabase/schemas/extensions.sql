create schema if not exists extensions;
create extension if not exists pgmq;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select pgmq.create('cofar_jobs');
select pgmq.create('cofar_jobs_dlq');
-- Queue internals are never exposed through PostgREST or browser roles.
revoke all on schema pgmq from public, anon, authenticated;
revoke all on all tables in schema pgmq from public, anon, authenticated;
revoke all on all functions in schema pgmq from public, anon, authenticated;
