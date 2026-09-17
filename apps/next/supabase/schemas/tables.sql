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
