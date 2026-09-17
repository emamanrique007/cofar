create type public.job_status as enum ('queued', 'completed', 'failed');
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
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

-- Support desk. Requesters open tickets; agents work one shared account queue.
create type public.ticket_status as enum ('new', 'assigned', 'in_progress', 'resolved', 'closed');
create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.ticket_category_source as enum ('requester', 'auto', 'agent');
create type public.ticket_availability as enum ('available', 'busy', 'offline');
create type public.ticket_event_type as enum ('created', 'classified', 'assigned', 'status_changed', 'priority_changed', 'recategorized', 'sla_breached');
create table public.ticket_categories (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (length(trim(name)) between 2 and 60),
  default_priority public.ticket_priority not null default 'normal',
  is_fallback boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (account_id, slug)
);
-- One account-wide destination for text the rules engine cannot classify.
create unique index ticket_categories_fallback_idx on public.ticket_categories(account_id) where is_fallback;
create table public.ticket_category_rules (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  category_id uuid not null references public.ticket_categories(id) on delete cascade,
  term text not null check (length(trim(term)) between 2 and 60),
  weight integer not null default 1 check (weight between 1 and 10),
  created_at timestamptz not null default now(),
  unique (category_id, term)
);
create index ticket_category_rules_account_idx on public.ticket_category_rules(account_id);
create table public.sla_policies (
  account_id uuid not null references public.accounts(id) on delete cascade,
  priority public.ticket_priority not null,
  first_response_minutes integer not null check (first_response_minutes between 5 and 100000),
  resolution_minutes integer not null check (resolution_minutes between 15 and 1000000),
  primary key (account_id, priority),
  constraint sla_policies_order_check check (resolution_minutes >= first_response_minutes)
);
create table public.ticket_agents (
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  availability public.ticket_availability not null default 'available',
  timezone text not null default 'UTC' check (length(trim(timezone)) between 1 and 64),
  max_open_tickets integer not null default 5 check (max_open_tickets between 1 and 100),
  auto_assign boolean not null default true,
  category_ids uuid[] not null default '{}'::uuid[] check (cardinality(category_ids) <= 100),
  working_days smallint[] not null default '{1,2,3,4,5}',
  workday_start time not null default '09:00',
  workday_end time not null default '18:00',
  last_assigned_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (account_id, user_id),
  constraint ticket_agents_working_days_check check (cardinality(working_days) between 1 and 7 and working_days <@ '{0,1,2,3,4,5,6}'::smallint[]),
  constraint ticket_agents_workday_check check (workday_start < workday_end)
);
create index ticket_agents_routing_idx on public.ticket_agents(account_id, availability, last_assigned_at) where auto_assign;
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  account_id uuid not null references public.accounts(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  category_id uuid references public.ticket_categories(id) on delete set null,
  category_source public.ticket_category_source,
  category_confidence numeric(4, 3) check (category_confidence between 0 and 1),
  title text not null check (length(trim(title)) between 5 and 120),
  description text not null check (length(trim(description)) between 10 and 4000),
  status public.ticket_status not null default 'new',
  priority public.ticket_priority not null default 'normal',
  first_response_due_at timestamptz not null,
  resolution_due_at timestamptz not null,
  first_responded_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  first_response_breached_at timestamptz,
  resolution_breached_at timestamptz,
  search_text tsvector generated always as (to_tsvector('spanish'::regconfig, title || ' ' || description)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, number)
);
create index tickets_queue_idx on public.tickets(account_id, status, created_at);
create index tickets_requester_idx on public.tickets(requester_id, created_at desc);
create index tickets_assignee_idx on public.tickets(assignee_id, status) where assignee_id is not null;
create index tickets_unassigned_idx on public.tickets(account_id, created_at) where status = 'new' and assignee_id is null;
create index tickets_search_idx on public.tickets using gin(search_text);
-- Immutable trail: every ticket change appends one row, nothing is updated.
create table public.ticket_events (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type public.ticket_event_type not null,
  from_value text,
  to_value text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index ticket_events_ticket_idx on public.ticket_events(ticket_id, created_at);
