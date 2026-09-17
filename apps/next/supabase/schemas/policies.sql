alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.users_by_accounts enable row level security;
alter table public.jobs enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
-- Colleagues in a shared account are visible to each other: tickets name people.
create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or exists(select 1 from public.users_by_accounts mine join public.users_by_accounts theirs on theirs.account_id = mine.account_id where mine.user_id = (select auth.uid()) and theirs.user_id = public.profiles.id));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy accounts_read on public.accounts for select to authenticated using (public.is_account_member(id));
create policy memberships_read on public.users_by_accounts for select to authenticated using (public.is_account_member(account_id));
create policy jobs_read on public.jobs for select to authenticated using (public.is_account_member(account_id));
create policy notifications_read on public.notifications for select to authenticated using (public.is_account_member(account_id));
create policy audit_read on public.audit_logs for select to authenticated using (public.is_account_member(account_id));
revoke all on public.profiles, public.accounts, public.users_by_accounts, public.jobs, public.notifications, public.audit_logs from anon, authenticated;
grant select on public.profiles, public.accounts, public.users_by_accounts, public.jobs, public.notifications, public.audit_logs to authenticated;
grant update(name) on public.profiles to authenticated;
alter table public.ticket_categories enable row level security;
alter table public.ticket_category_rules enable row level security;
alter table public.sla_policies enable row level security;
alter table public.ticket_agents enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_events enable row level security;
create policy ticket_categories_read on public.ticket_categories for select to authenticated using (public.is_account_member(account_id));
-- Keyword rules are internal metadata, not secrets: members read them so the
-- classifier can run with the caller's own client, agents correct them in Studio.
create policy ticket_category_rules_read on public.ticket_category_rules for select to authenticated using (public.is_account_member(account_id));
create policy sla_policies_read on public.sla_policies for select to authenticated using (public.is_account_member(account_id));
create policy ticket_agents_read on public.ticket_agents for select to authenticated using (public.is_account_member(account_id));
-- Two profiles, two views: a requester sees only their own tickets, an agent the whole account queue.
create policy tickets_read on public.tickets for select to authenticated
using (public.is_account_member(account_id) and (requester_id = (select auth.uid()) or public.is_ticket_agent(account_id)));
create policy ticket_events_read on public.ticket_events for select to authenticated
using (exists(select 1 from public.tickets ticket where ticket.id = public.ticket_events.ticket_id and (ticket.requester_id = (select auth.uid()) or public.is_ticket_agent(ticket.account_id))));
revoke all on public.ticket_categories, public.ticket_category_rules, public.sla_policies, public.ticket_agents, public.tickets, public.ticket_events from anon, authenticated;
grant select on public.ticket_categories, public.ticket_category_rules, public.sla_policies, public.ticket_agents, public.tickets, public.ticket_events to authenticated;
