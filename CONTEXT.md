# Cofar vocabulary

- Account: a workspace whose members share access to its data.
- User: an authenticated person, potentially belonging to more than one account.
- Member: a user's relationship to an account, with owner or member role.
- Job: a durable request to perform background work for an account.
- Notification: a stored message produced by a completed job.
- Dead-letter queue: retained jobs that exhausted automatic retries and need investigation.
- Ticket: a support request opened by a member of an account.
- Requester: the member who opened a ticket and sees only their own.
- Agent: a member listed in ticket_agents, who works the shared account queue.
- Category: the taxonomy entry that decides a ticket's priority.
- Rule: a weighted term that moves a ticket towards one category.
- Priority: the level that selects the SLA policy of a ticket.
- SLA policy: the promised first response and resolution minutes for a priority.
- Coverage: the union of the agents' shifts, used as the SLA clock.
- Shift: an agent's working days, hours and timezone.
- Ticket event: one immutable entry of a ticket's trail.
