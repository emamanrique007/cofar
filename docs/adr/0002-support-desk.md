# 0002 — Support desk

Status: accepted.

The desk is a vertical slice on the existing platform: Supabase tables with RLS,
`security definer` RPCs for every write, typed tRPC procedures, Next App Router
views and one authenticated cron route. No new datastore, service or runtime was
introduced.

## Classification by rules, not by a model

Categorization uses weighted keyword rules stored per account and a pure
function in `@cofar/utils`. The alternative was a language model, as used
elsewhere in our stack. Rules were chosen because the workspace has no AI
provider configured and this repository must not require credentials for a
service it does not own; because the result is deterministic and fully covered
by `pnpm check` without network access; and because an explainable suggestion
("these words put it here") is what makes an agent trust or correct it.

The cost is recall: synonyms outside the rule set fall back to `Sin clasificar`
instead of being guessed. That is the intended failure mode — the fallback is a
human decision, not a wrong label. Every correction is recorded with the
previous source and confidence, which is the dataset needed to tune the rules or,
later, to evaluate a model against a measured baseline. Swapping the engine means
replacing one call in `tickets.create`, since classification has no other caller.

## The SLA clock is the team's coverage

Working hours belong to each agent, not to the account. The deadline therefore
advances over the union of the agents' shifts, each evaluated in that agent's own
timezone. A 24/7 clock would charge the team for the night, and a per-agent clock
would move the promise every time a ticket changes hands. An account with no
agents falls back to elapsed time rather than failing to create the ticket.

Deadlines are computed once at creation and recomputed from `created_at` when the
priority changes, so escalating a ticket restates the original promise instead of
restarting it.

## Writes through RPCs, reads through RLS

`authenticated` holds only `select` on the desk tables. Status, assignment,
categories and SLA columns are written exclusively by RPCs that check membership
or agent role, lock the row, and append the corresponding `ticket_events`.
This keeps the audit trail impossible to skip and the state machine in one place.

## The desk worker does not use PGMQ

Routing and SLA breaches are database state, not messages: there is nothing to
acknowledge, both operations are idempotent, and a missed run catches up on the
next minute. Adding queue messages would add a failure mode without adding a
guarantee. The PGMQ slice stays for work that must survive a retry with a
receipt.

## Scope

Beyond the mandatory scope the exercise asks for at most two optional items:
**SLA per priority** and **automatic categorization** were chosen, because they
are what turns a list of tickets into a system with promises and routing.
Search, filters and the metrics dashboard were included as a by-product of the
agent queue: they read columns the desk already maintains and cost little.

Discarded, and why: **attachments** need bucket policies, size limits and
antivirus decisions that add no product insight here; **notifications** need an
email provider and a delivery idempotency key that this workspace has no
credentials for, so breaches surface in the queue, the trail and the dashboard
instead; **comments** would double the RLS surface (public replies versus
internal notes) without changing how the desk routes or measures work;
**reassignment** stays out because one queue with self-service take covers the
first version and reassignment invites a team-hierarchy model this version does
not have.

Known limits: ticket numbers come from a global identity column, so they are
unique but not per-account sequential; automatic assignment assumes a single
concurrent worker; the transition table exists both in SQL (enforced) and in the
UI helper (affordances), and the SQL one is authoritative.

Verification: `pnpm check`, `pnpm db:test`, `pnpm e2e`.
