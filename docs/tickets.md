# Support desk

Two profiles share one account. A **requester** is any account member: they open
tickets and see only their own. An **agent** is a member with a row in
`ticket_agents`: they see the whole account queue, take tickets and move them.
The account **owner** additionally adds people and promotes them to agents.
`tickets_read` enforces the split in SQL, so a requester cannot read the queue
even by calling PostgREST directly.

Every write goes through a `security definer` RPC. `authenticated` only holds
`select` on the ticket tables, which keeps status, assignment and SLA columns
impossible to forge from the browser.

## States

`new → assigned → in_progress → resolved → closed`, with `resolved → in_progress`
to reopen. `new` leaves only through `claim_ticket` (an agent takes it) or
`auto_assign_ticket` (the cron routes it). An agent may move
`assigned → in_progress | resolved`, `in_progress → resolved` and
`resolved → closed | in_progress`. The requester of a ticket may only confirm or
reopen a resolution (`resolved → closed | in_progress`). Anything else raises
`22023` and the router turns it into a `BAD_REQUEST`. `nextStatuses` in
`ticket.view.utils.ts` mirrors the same table so the UI offers only valid moves.

## Traceability

`ticket_events` is append-only: `created`, `classified`, `assigned`,
`status_changed`, `priority_changed`, `recategorized` and `sla_breached`. Each
row keeps the actor (null when the worker acted), the previous and next value,
and a `detail` payload — the classifier evidence, the routing mode (`self` or
`auto`) or the breached target. The ticket detail view renders them in order.

## Automatic categorization

`ticket_category_rules` holds weighted terms per category. `classifyTicket`
(`packages/utils`) normalizes title and description (lowercase, accents removed,
non-alphanumerics collapsed), counts whole-word matches up to three per term,
weighs title evidence double, and adds up one score per category.

A suggestion is accepted when the winner scores at least 4 points, holds at
least 55% of the evidence, and is not tied with another category. Otherwise the
ticket lands in the account's fallback category (`Sin clasificar`) for a human
to decide.

In the form the requester picks the category, so the classifier runs as a second
opinion: when it disagrees, `create_ticket` writes a `classified` event with
`agrees: false`, the chosen slug and the suggested one, and the agent settles it.
The classifier assigns the category outright only when nobody chose, which is the
path for tickets arriving from another channel (`source = 'auto'`).
`tickets.create` runs it with the caller's own client, so rules are readable by
members; they are internal metadata, not secrets.

The category decides the priority (`ticket_categories.default_priority`) and the
priority decides the SLA targets. When an agent fixes a category,
`set_ticket_category` records the correction with the previous source and
confidence: that trail is the input for tuning the rules.

## SLA

`sla_policies` stores `first_response_minutes` and `resolution_minutes` per
priority, seeded as urgent 30/240, high 60/480, normal 240/1440, low 480/2400.

Working hours belong to each agent (`working_days`, `workday_start`,
`workday_end`, `timezone`), so the team's coverage is the union of its agents'
shifts. `support_coverage_deadline` merges those shifts into intervals and walks
them until the promised minutes are consumed; a desk with no agents falls back
to elapsed time. Deadlines are stored on the ticket at creation, and recomputed
from `created_at` when the priority changes.

The first response clock stops when a human acts: taking a ticket or moving it
forward. Automatic routing does not stop it. `sweep_ticket_sla` stamps
`first_response_breached_at` / `resolution_breached_at` once per target and
writes the `sla_breached` event; `overdue` in the queue filter reads those
columns.

## Routing

`pending_ticket_assignments` returns unassigned `new` tickets, highest priority
and oldest first, for accounts that have at least one agent with `auto_assign`.
`auto_assign_ticket` locks the ticket and looks for an agent who is available,
on shift in their own timezone, below `max_open_tickets`, and covering the ticket
category (`category_ids` empty means every category). Among those it picks the
one emptiest relative to their own cap, so a full agent never takes another
ticket while a colleague covering the same category is free; ties go to whoever
waited longest for work, and then to the lowest id so the order is stable.

When nobody qualifies the ticket stays in the queue with its SLA clock running,
and the next run assigns it as soon as somebody resolves a ticket and frees a
slot.

`processTicketQueue` skips the rest of an `(account, category)` route as soon as
one ticket in it finds nobody, which keeps a run bounded when a category has no
one on shift.

## tRPC procedures

All of them use `userProcedure` and the request-scoped client, so RLS applies.

| Procedure                   | Input                                                                          | Result                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `tickets.categories`        | `accountId`                                                                    | active categories of the account                                                                                   |
| `tickets.policies`          | `accountId`                                                                    | SLA targets per priority                                                                                           |
| `tickets.list`              | filters: scope, assignment, status, priority, category, overdue, search, order | up to 100 tickets with category, requester and assignee                                                            |
| `tickets.detail`            | `ticketId`                                                                     | ticket plus its events                                                                                             |
| `tickets.create`            | `accountId`, title, description, category                                      | persisted `{ ticket_id, number, category, priority }` and the classifier suggestion                                |
| `tickets.claim`             | `ticketId`                                                                     | `{ claimed }`, false when another agent got there first                                                            |
| `tickets.setStatus`         | `ticketId`, status                                                             | `{ changed }`                                                                                                      |
| `tickets.setPriority`       | `ticketId`, priority                                                           | `{ changed }`, deadlines recomputed                                                                                |
| `tickets.setCategory`       | `ticketId`, categoryId                                                         | `{ changed }`, correction recorded                                                                                 |
| `tickets.metrics`           | `accountId`                                                                    | agent-only counters, SLA compliance and breakdowns                                                                 |
| `agents.me` / `agents.list` | `accountId`                                                                    | own shift / roster with agent settings                                                                             |
| `agents.create`             | `accountId`, name, email, password, asAgent and the shift                      | owner-only: creates the login with the service role, then the membership and the shift through the caller's client |
| `agents.invite`             | `accountId`, email, asAgent                                                    | owner-only, resolves an existing user by email                                                                     |
| `agents.setAgent`           | `accountId`, userId, enabled                                                   | owner-only; refuses to remove an agent with open tickets                                                           |
| `agents.updateShift`        | `accountId`, availability, timezone, days, hours, load, autoAssign             | the agent's own shift                                                                                              |

Search uses the `search_text` tsvector (Spanish configuration, `websearch`
syntax) over title and description.

## Verification

`pnpm db:test` covers RLS isolation between requester, agent and other accounts,
forged writes, the claim race, invalid transitions, routing by shift and load,
and the breach sweep. `pnpm test` covers the classifier, the SLA traffic light,
the transition table and the worker loop.

`pnpm e2e` walks the product: `workspace.spec.ts` creates a space from the
picker, `tickets.spec.ts` runs the request lifecycle with two browser sessions,
`support-desk.spec.ts` hires an agent from the team screen and drives the
worker over HTTP (routing on shift, a busy agent parking work, the sweep, and
the 401/400/422/200 contract), and `routing.spec.ts` splits the queue between
two agents, waits when both are at cap, checks the metrics against the table
and keeps each profile off the screens it must not see.
