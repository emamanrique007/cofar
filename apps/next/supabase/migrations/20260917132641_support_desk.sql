create type "public"."ticket_availability" as enum ('available', 'busy', 'offline');

create type "public"."ticket_category_source" as enum ('requester', 'auto', 'agent');

create type "public"."ticket_event_type" as enum ('created', 'classified', 'assigned', 'status_changed', 'priority_changed', 'recategorized', 'sla_breached');

create type "public"."ticket_priority" as enum ('low', 'normal', 'high', 'urgent');

create type "public"."ticket_status" as enum ('new', 'assigned', 'in_progress', 'resolved', 'closed');

drop policy "profiles_read" on "public"."profiles";

drop policy "memberships_read" on "public"."users_by_accounts";

drop function if exists "public"."create_account"(account_name text);


  create table "public"."sla_policies" (
    "account_id" uuid not null,
    "priority" public.ticket_priority not null,
    "first_response_minutes" integer not null,
    "resolution_minutes" integer not null
      );


alter table "public"."sla_policies" enable row level security;


  create table "public"."ticket_agents" (
    "account_id" uuid not null,
    "user_id" uuid not null,
    "availability" public.ticket_availability not null default 'available'::public.ticket_availability,
    "timezone" text not null default 'UTC'::text,
    "max_open_tickets" integer not null default 5,
    "auto_assign" boolean not null default true,
    "category_ids" uuid[] not null default '{}'::uuid[],
    "working_days" smallint[] not null default '{1,2,3,4,5}'::smallint[],
    "workday_start" time without time zone not null default '09:00:00'::time without time zone,
    "workday_end" time without time zone not null default '18:00:00'::time without time zone,
    "last_assigned_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."ticket_agents" enable row level security;


  create table "public"."ticket_categories" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid not null,
    "slug" text not null,
    "name" text not null,
    "default_priority" public.ticket_priority not null default 'normal'::public.ticket_priority,
    "is_fallback" boolean not null default false,
    "active" boolean not null default true,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."ticket_categories" enable row level security;


  create table "public"."ticket_category_rules" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid not null,
    "category_id" uuid not null,
    "term" text not null,
    "weight" integer not null default 1,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."ticket_category_rules" enable row level security;


  create table "public"."ticket_events" (
    "id" bigint generated always as identity not null,
    "account_id" uuid not null,
    "ticket_id" uuid not null,
    "actor_id" uuid,
    "type" public.ticket_event_type not null,
    "from_value" text,
    "to_value" text,
    "detail" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."ticket_events" enable row level security;


  create table "public"."tickets" (
    "id" uuid not null default gen_random_uuid(),
    "number" bigint generated always as identity not null,
    "account_id" uuid not null,
    "requester_id" uuid not null,
    "assignee_id" uuid,
    "category_id" uuid,
    "category_source" public.ticket_category_source,
    "category_confidence" numeric(4,3),
    "title" text not null,
    "description" text not null,
    "status" public.ticket_status not null default 'new'::public.ticket_status,
    "priority" public.ticket_priority not null default 'normal'::public.ticket_priority,
    "first_response_due_at" timestamp with time zone not null,
    "resolution_due_at" timestamp with time zone not null,
    "first_responded_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "first_response_breached_at" timestamp with time zone,
    "resolution_breached_at" timestamp with time zone,
    "search_text" tsvector generated always as (to_tsvector('spanish'::regconfig, ((title || ' '::text) || description))) stored,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."tickets" enable row level security;

alter table "public"."profiles" add column "email" text not null default ''::text;

CREATE UNIQUE INDEX sla_policies_pkey ON public.sla_policies USING btree (account_id, priority);

CREATE UNIQUE INDEX ticket_agents_pkey ON public.ticket_agents USING btree (account_id, user_id);

CREATE INDEX ticket_agents_routing_idx ON public.ticket_agents USING btree (account_id, availability, last_assigned_at) WHERE auto_assign;

CREATE UNIQUE INDEX ticket_categories_account_id_slug_key ON public.ticket_categories USING btree (account_id, slug);

CREATE UNIQUE INDEX ticket_categories_fallback_idx ON public.ticket_categories USING btree (account_id) WHERE is_fallback;

CREATE UNIQUE INDEX ticket_categories_pkey ON public.ticket_categories USING btree (id);

CREATE INDEX ticket_category_rules_account_idx ON public.ticket_category_rules USING btree (account_id);

CREATE UNIQUE INDEX ticket_category_rules_category_id_term_key ON public.ticket_category_rules USING btree (category_id, term);

CREATE UNIQUE INDEX ticket_category_rules_pkey ON public.ticket_category_rules USING btree (id);

CREATE UNIQUE INDEX ticket_events_pkey ON public.ticket_events USING btree (id);

CREATE INDEX ticket_events_ticket_idx ON public.ticket_events USING btree (ticket_id, created_at);

CREATE UNIQUE INDEX tickets_account_id_number_key ON public.tickets USING btree (account_id, number);

CREATE INDEX tickets_assignee_idx ON public.tickets USING btree (assignee_id, status) WHERE (assignee_id IS NOT NULL);

CREATE UNIQUE INDEX tickets_pkey ON public.tickets USING btree (id);

CREATE INDEX tickets_queue_idx ON public.tickets USING btree (account_id, status, created_at);

CREATE INDEX tickets_requester_idx ON public.tickets USING btree (requester_id, created_at DESC);

CREATE INDEX tickets_search_idx ON public.tickets USING gin (search_text);

CREATE INDEX tickets_unassigned_idx ON public.tickets USING btree (account_id, created_at) WHERE ((status = 'new'::public.ticket_status) AND (assignee_id IS NULL));

alter table "public"."sla_policies" add constraint "sla_policies_pkey" PRIMARY KEY using index "sla_policies_pkey";

alter table "public"."ticket_agents" add constraint "ticket_agents_pkey" PRIMARY KEY using index "ticket_agents_pkey";

alter table "public"."ticket_categories" add constraint "ticket_categories_pkey" PRIMARY KEY using index "ticket_categories_pkey";

alter table "public"."ticket_category_rules" add constraint "ticket_category_rules_pkey" PRIMARY KEY using index "ticket_category_rules_pkey";

alter table "public"."ticket_events" add constraint "ticket_events_pkey" PRIMARY KEY using index "ticket_events_pkey";

alter table "public"."tickets" add constraint "tickets_pkey" PRIMARY KEY using index "tickets_pkey";

alter table "public"."sla_policies" add constraint "sla_policies_account_id_fkey" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."sla_policies" validate constraint "sla_policies_account_id_fkey";

alter table "public"."sla_policies" add constraint "sla_policies_first_response_minutes_check" CHECK (((first_response_minutes >= 5) AND (first_response_minutes <= 100000))) not valid;

alter table "public"."sla_policies" validate constraint "sla_policies_first_response_minutes_check";

alter table "public"."sla_policies" add constraint "sla_policies_order_check" CHECK ((resolution_minutes >= first_response_minutes)) not valid;

alter table "public"."sla_policies" validate constraint "sla_policies_order_check";

alter table "public"."sla_policies" add constraint "sla_policies_resolution_minutes_check" CHECK (((resolution_minutes >= 15) AND (resolution_minutes <= 1000000))) not valid;

alter table "public"."sla_policies" validate constraint "sla_policies_resolution_minutes_check";

alter table "public"."ticket_agents" add constraint "ticket_agents_account_id_fkey" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."ticket_agents" validate constraint "ticket_agents_account_id_fkey";

alter table "public"."ticket_agents" add constraint "ticket_agents_category_ids_check" CHECK ((cardinality(category_ids) <= 100)) not valid;

alter table "public"."ticket_agents" validate constraint "ticket_agents_category_ids_check";

alter table "public"."ticket_agents" add constraint "ticket_agents_max_open_tickets_check" CHECK (((max_open_tickets >= 1) AND (max_open_tickets <= 100))) not valid;

alter table "public"."ticket_agents" validate constraint "ticket_agents_max_open_tickets_check";

alter table "public"."ticket_agents" add constraint "ticket_agents_timezone_check" CHECK (((length(TRIM(BOTH FROM timezone)) >= 1) AND (length(TRIM(BOTH FROM timezone)) <= 64))) not valid;

alter table "public"."ticket_agents" validate constraint "ticket_agents_timezone_check";

alter table "public"."ticket_agents" add constraint "ticket_agents_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."ticket_agents" validate constraint "ticket_agents_user_id_fkey";

alter table "public"."ticket_agents" add constraint "ticket_agents_workday_check" CHECK ((workday_start < workday_end)) not valid;

alter table "public"."ticket_agents" validate constraint "ticket_agents_workday_check";

alter table "public"."ticket_agents" add constraint "ticket_agents_working_days_check" CHECK ((((cardinality(working_days) >= 1) AND (cardinality(working_days) <= 7)) AND (working_days <@ '{0,1,2,3,4,5,6}'::smallint[]))) not valid;

alter table "public"."ticket_agents" validate constraint "ticket_agents_working_days_check";

alter table "public"."ticket_categories" add constraint "ticket_categories_account_id_fkey" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."ticket_categories" validate constraint "ticket_categories_account_id_fkey";

alter table "public"."ticket_categories" add constraint "ticket_categories_account_id_slug_key" UNIQUE using index "ticket_categories_account_id_slug_key";

alter table "public"."ticket_categories" add constraint "ticket_categories_name_check" CHECK (((length(TRIM(BOTH FROM name)) >= 2) AND (length(TRIM(BOTH FROM name)) <= 60))) not valid;

alter table "public"."ticket_categories" validate constraint "ticket_categories_name_check";

alter table "public"."ticket_categories" add constraint "ticket_categories_slug_check" CHECK ((slug ~ '^[a-z0-9-]{2,40}$'::text)) not valid;

alter table "public"."ticket_categories" validate constraint "ticket_categories_slug_check";

alter table "public"."ticket_category_rules" add constraint "ticket_category_rules_account_id_fkey" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."ticket_category_rules" validate constraint "ticket_category_rules_account_id_fkey";

alter table "public"."ticket_category_rules" add constraint "ticket_category_rules_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.ticket_categories(id) ON DELETE CASCADE not valid;

alter table "public"."ticket_category_rules" validate constraint "ticket_category_rules_category_id_fkey";

alter table "public"."ticket_category_rules" add constraint "ticket_category_rules_category_id_term_key" UNIQUE using index "ticket_category_rules_category_id_term_key";

alter table "public"."ticket_category_rules" add constraint "ticket_category_rules_term_check" CHECK (((length(TRIM(BOTH FROM term)) >= 2) AND (length(TRIM(BOTH FROM term)) <= 60))) not valid;

alter table "public"."ticket_category_rules" validate constraint "ticket_category_rules_term_check";

alter table "public"."ticket_category_rules" add constraint "ticket_category_rules_weight_check" CHECK (((weight >= 1) AND (weight <= 10))) not valid;

alter table "public"."ticket_category_rules" validate constraint "ticket_category_rules_weight_check";

alter table "public"."ticket_events" add constraint "ticket_events_account_id_fkey" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."ticket_events" validate constraint "ticket_events_account_id_fkey";

alter table "public"."ticket_events" add constraint "ticket_events_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."ticket_events" validate constraint "ticket_events_actor_id_fkey";

alter table "public"."ticket_events" add constraint "ticket_events_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE not valid;

alter table "public"."ticket_events" validate constraint "ticket_events_ticket_id_fkey";

alter table "public"."tickets" add constraint "tickets_account_id_fkey" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."tickets" validate constraint "tickets_account_id_fkey";

alter table "public"."tickets" add constraint "tickets_account_id_number_key" UNIQUE using index "tickets_account_id_number_key";

alter table "public"."tickets" add constraint "tickets_assignee_id_fkey" FOREIGN KEY (assignee_id) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."tickets" validate constraint "tickets_assignee_id_fkey";

alter table "public"."tickets" add constraint "tickets_category_confidence_check" CHECK (((category_confidence >= (0)::numeric) AND (category_confidence <= (1)::numeric))) not valid;

alter table "public"."tickets" validate constraint "tickets_category_confidence_check";

alter table "public"."tickets" add constraint "tickets_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.ticket_categories(id) ON DELETE SET NULL not valid;

alter table "public"."tickets" validate constraint "tickets_category_id_fkey";

alter table "public"."tickets" add constraint "tickets_description_check" CHECK (((length(TRIM(BOTH FROM description)) >= 10) AND (length(TRIM(BOTH FROM description)) <= 4000))) not valid;

alter table "public"."tickets" validate constraint "tickets_description_check";

alter table "public"."tickets" add constraint "tickets_requester_id_fkey" FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."tickets" validate constraint "tickets_requester_id_fkey";

alter table "public"."tickets" add constraint "tickets_title_check" CHECK (((length(TRIM(BOTH FROM title)) >= 5) AND (length(TRIM(BOTH FROM title)) <= 120))) not valid;

alter table "public"."tickets" validate constraint "tickets_title_check";

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
  order by agent.last_assigned_at nulls first, workload.open_tickets, agent.user_id
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

CREATE OR REPLACE FUNCTION public.claim_ticket(ticket uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_account(account_name text, agent_timezone text DEFAULT 'UTC'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_ticket(target_account uuid, ticket_title text, ticket_description text, category uuid DEFAULT NULL::uuid, source public.ticket_category_source DEFAULT 'requester'::public.ticket_category_source, confidence numeric DEFAULT NULL::numeric, evidence jsonb DEFAULT '{}'::jsonb)
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
    values (target_account, created.id, auth.uid(), 'classified', chosen.slug, jsonb_build_object('confidence', confidence, 'evidence', coalesce(evidence, '{}'::jsonb)));
  end if;
  insert into public.audit_logs(account_id, actor_id, action, entity_id) values (target_account, auth.uid(), 'ticket.created', created.id);
  -- The caller sees what was persisted, not what it proposed.
  return jsonb_build_object('ticket_id', created.id, 'number', created.number, 'category_id', chosen.id, 'category', chosen.name, 'priority', ticket_priority);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.invite_account_member(target_account uuid, member_email text, make_agent boolean DEFAULT false, agent_timezone text DEFAULT 'UTC'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.is_ticket_agent(target_account uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(select 1 from public.ticket_agents where account_id = target_account and user_id = (select auth.uid()));
$function$
;

CREATE OR REPLACE FUNCTION public.pending_ticket_assignments(batch integer DEFAULT 25)
 RETURNS TABLE(id uuid, account_id uuid, category_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.safe_timezone(candidate text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare result text := coalesce(nullif(trim(candidate), ''), 'UTC');
begin
  perform timestamptz '2000-01-01 00:00:00Z' at time zone result;
  return result;
exception when others then
  return 'UTC';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.seed_support_desk(target_account uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_support_agent(target_account uuid, member uuid, enabled boolean, agent_timezone text DEFAULT 'UTC'::text)
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_ticket_category(ticket uuid, category uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_ticket_priority(ticket uuid, next_priority public.ticket_priority)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_ticket_status(ticket uuid, next_status public.ticket_status)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.support_coverage_deadline(target_account uuid, start_at timestamp with time zone, minutes integer)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.sweep_ticket_sla(batch integer DEFAULT 200)
 RETURNS TABLE(first_response integer, resolution integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.ticket_metrics(target_account uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_agent_shift(target_account uuid, next_availability public.ticket_availability, agent_timezone text, days smallint[], day_start time without time zone, day_end time without time zone, max_open integer, auto boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_ticket_agent(target_account) then raise exception 'Agent access denied' using errcode = '42501'; end if;
  if day_start >= day_end then raise exception 'Invalid working hours' using errcode = '22023'; end if;
  update public.ticket_agents set availability = next_availability, timezone = public.safe_timezone(agent_timezone),
    working_days = days, workday_start = day_start, workday_end = day_end,
    max_open_tickets = max_open, auto_assign = auto
  where account_id = target_account and user_id = (select auth.uid());
  return found;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles(id, name, email) values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), coalesce(new.email, ''));
  return new;
end;
$function$
;

grant select on table "public"."sla_policies" to "authenticated";

grant delete on table "public"."sla_policies" to "service_role";

grant insert on table "public"."sla_policies" to "service_role";

grant references on table "public"."sla_policies" to "service_role";

grant select on table "public"."sla_policies" to "service_role";

grant trigger on table "public"."sla_policies" to "service_role";

grant truncate on table "public"."sla_policies" to "service_role";

grant update on table "public"."sla_policies" to "service_role";

grant select on table "public"."ticket_agents" to "authenticated";

grant delete on table "public"."ticket_agents" to "service_role";

grant insert on table "public"."ticket_agents" to "service_role";

grant references on table "public"."ticket_agents" to "service_role";

grant select on table "public"."ticket_agents" to "service_role";

grant trigger on table "public"."ticket_agents" to "service_role";

grant truncate on table "public"."ticket_agents" to "service_role";

grant update on table "public"."ticket_agents" to "service_role";

grant select on table "public"."ticket_categories" to "authenticated";

grant delete on table "public"."ticket_categories" to "service_role";

grant insert on table "public"."ticket_categories" to "service_role";

grant references on table "public"."ticket_categories" to "service_role";

grant select on table "public"."ticket_categories" to "service_role";

grant trigger on table "public"."ticket_categories" to "service_role";

grant truncate on table "public"."ticket_categories" to "service_role";

grant update on table "public"."ticket_categories" to "service_role";

grant select on table "public"."ticket_category_rules" to "authenticated";

grant delete on table "public"."ticket_category_rules" to "service_role";

grant insert on table "public"."ticket_category_rules" to "service_role";

grant references on table "public"."ticket_category_rules" to "service_role";

grant select on table "public"."ticket_category_rules" to "service_role";

grant trigger on table "public"."ticket_category_rules" to "service_role";

grant truncate on table "public"."ticket_category_rules" to "service_role";

grant update on table "public"."ticket_category_rules" to "service_role";

grant select on table "public"."ticket_events" to "authenticated";

grant delete on table "public"."ticket_events" to "service_role";

grant insert on table "public"."ticket_events" to "service_role";

grant references on table "public"."ticket_events" to "service_role";

grant select on table "public"."ticket_events" to "service_role";

grant trigger on table "public"."ticket_events" to "service_role";

grant truncate on table "public"."ticket_events" to "service_role";

grant update on table "public"."ticket_events" to "service_role";

grant select on table "public"."tickets" to "authenticated";

grant delete on table "public"."tickets" to "service_role";

grant insert on table "public"."tickets" to "service_role";

grant references on table "public"."tickets" to "service_role";

grant select on table "public"."tickets" to "service_role";

grant trigger on table "public"."tickets" to "service_role";

grant truncate on table "public"."tickets" to "service_role";

grant update on table "public"."tickets" to "service_role";


  create policy "sla_policies_read"
  on "public"."sla_policies"
  as permissive
  for select
  to authenticated
using (public.is_account_member(account_id));



  create policy "ticket_agents_read"
  on "public"."ticket_agents"
  as permissive
  for select
  to authenticated
using (public.is_account_member(account_id));



  create policy "ticket_categories_read"
  on "public"."ticket_categories"
  as permissive
  for select
  to authenticated
using (public.is_account_member(account_id));



  create policy "ticket_category_rules_read"
  on "public"."ticket_category_rules"
  as permissive
  for select
  to authenticated
using (public.is_account_member(account_id));



  create policy "ticket_events_read"
  on "public"."ticket_events"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.tickets ticket
  WHERE ((ticket.id = ticket_events.ticket_id) AND ((ticket.requester_id = ( SELECT auth.uid() AS uid)) OR public.is_ticket_agent(ticket.account_id))))));



  create policy "tickets_read"
  on "public"."tickets"
  as permissive
  for select
  to authenticated
using ((public.is_account_member(account_id) AND ((requester_id = ( SELECT auth.uid() AS uid)) OR public.is_ticket_agent(account_id))));



  create policy "profiles_read"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (((id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM (public.users_by_accounts mine
     JOIN public.users_by_accounts theirs ON ((theirs.account_id = mine.account_id)))
  WHERE ((mine.user_id = ( SELECT auth.uid() AS uid)) AND (theirs.user_id = profiles.id))))));



  create policy "memberships_read"
  on "public"."users_by_accounts"
  as permissive
  for select
  to authenticated
using (public.is_account_member(account_id));

-- The schema diff does not emit function privileges or publications.
-- These mirror supabase/schemas/functions.sql, policies.sql and realtime.sql.
revoke all on function public.safe_timezone(text) from public, anon, authenticated;
revoke all on function public.seed_support_desk(uuid) from public, anon, authenticated;
revoke all on function public.create_account(text, text) from public, anon;
grant execute on function public.create_account(text, text) to authenticated;
revoke all on function public.is_ticket_agent(uuid) from public, anon;
grant execute on function public.is_ticket_agent(uuid) to authenticated;
revoke all on function public.support_coverage_deadline(uuid, timestamptz, integer) from public, anon;
grant execute on function public.support_coverage_deadline(uuid, timestamptz, integer) to authenticated;
revoke all on function public.create_ticket(uuid, text, text, uuid, public.ticket_category_source, numeric, jsonb) from public, anon;
grant execute on function public.create_ticket(uuid, text, text, uuid, public.ticket_category_source, numeric, jsonb) to authenticated;
revoke all on function public.claim_ticket(uuid) from public, anon;
grant execute on function public.claim_ticket(uuid) to authenticated;
revoke all on function public.set_ticket_status(uuid, public.ticket_status) from public, anon;
grant execute on function public.set_ticket_status(uuid, public.ticket_status) to authenticated;
revoke all on function public.set_ticket_priority(uuid, public.ticket_priority) from public, anon;
grant execute on function public.set_ticket_priority(uuid, public.ticket_priority) to authenticated;
revoke all on function public.set_ticket_category(uuid, uuid) from public, anon;
grant execute on function public.set_ticket_category(uuid, uuid) to authenticated;
revoke all on function public.ticket_metrics(uuid) from public, anon;
grant execute on function public.ticket_metrics(uuid) to authenticated;
revoke all on function public.invite_account_member(uuid, text, boolean, text) from public, anon;
grant execute on function public.invite_account_member(uuid, text, boolean, text) to authenticated;
revoke all on function public.set_support_agent(uuid, uuid, boolean, text) from public, anon;
grant execute on function public.set_support_agent(uuid, uuid, boolean, text) to authenticated;
revoke all on function public.update_agent_shift(uuid, public.ticket_availability, text, smallint[], time, time, integer, boolean) from public, anon;
grant execute on function public.update_agent_shift(uuid, public.ticket_availability, text, smallint[], time, time, integer, boolean) to authenticated;
revoke all on function public.pending_ticket_assignments(integer), public.auto_assign_ticket(uuid), public.sweep_ticket_sla(integer) from public, anon, authenticated;
grant execute on function public.pending_ticket_assignments(integer), public.auto_assign_ticket(uuid), public.sweep_ticket_sla(integer) to service_role;
revoke all on public.ticket_categories, public.ticket_category_rules, public.sla_policies, public.ticket_agents, public.tickets, public.ticket_events from anon, authenticated;
grant select on public.ticket_categories, public.ticket_category_rules, public.sla_policies, public.ticket_agents, public.tickets, public.ticket_events to authenticated;

alter publication supabase_realtime add table public.tickets, public.ticket_events;
