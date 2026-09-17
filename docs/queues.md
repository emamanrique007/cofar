# Queue operations

Producer: authenticated tRPC jobs.enqueue → enqueue_job transaction → jobs + pgmq.cofar_jobs.
Consumer: POST /api/cron/jobs with Authorization: Bearer <CRON_AUTH_SECRET> → read_jobs → complete_job or fail_job.

Messages are delivered at least once. The worker reads at most 10 per batch, with 120-second leases, 60-second route limit, and read_ct fencing. Notification insert, completed state and archive commit together. Retry delays are 2, 4, 8, 16 seconds; attempt 5 moves the message to cofar_jobs_dlq atomically. A stale receipt is ignored.

For automatic processing set Vault secrets `cofar_app_url` and `cofar_cron_secret`, then execute apps/next/supabase/schedule.sql as database owner. The secret must match the app CRON_AUTH_SECRET. Cron runs every minute. Set the deployed HTTPS app origin; local Docker can use http://host.docker.internal:3005 if the host mapping is available.

Inspect `cron.job_run_details`, `net._http_response`, `pgmq.metrics('cofar_jobs')`, `pgmq.q_cofar_jobs_dlq`, and public.jobs for failures. The fixed worker batch processes at most 10 messages per minute with this schedule. Increase frequency/batch only after measuring handler duration versus the lease. Do not expose queue tables or the service role to browsers.

DLQ replay is an operator transaction: lock the dead-letter message, repair its cause, reset the corresponding failed job to queued, send the corrected payload to cofar_jobs, then archive the DLQ entry. Commit all steps together. Do not replay completed jobs or delete messages merely to clear a dashboard. Archives and audit retention should be configured according to actual operational requirements.

When adding external email/webhook effects, use job ID as an idempotency key at the destination. The current SQL transaction guarantees a single stored notification, not exactly-once network delivery.

HTTP contract: `api(request).input(vCron.jobs()).handle(...).output(vCron.result())`. An empty body or `{}` is accepted; other body fields are rejected. Success returns `{ "data": { "read": 0, "completed": 0, "failed": 0, "stale": 0 } }`. Malformed JSON returns 400, invalid input 422, missing/invalid bearer authorization 401, and internal failures 500 without exposing database details. The HTTP utility validates headers, search parameters, body and route parameters before invoking the handler.

## Support desk worker

`POST /api/cron/tickets` with the same bearer secret runs the desk worker:
`pending_ticket_assignments` → `auto_assign_ticket` per ticket →
`sweep_ticket_sla`. It returns
`{ "data": { "pending": 0, "assigned": 0, "unroutable": 0, "breached_first_response": 0, "breached_resolution": 0 } }`
and uses the same status contract as the jobs route (400/401/422/500).

This worker does not use PGMQ: routing and SLA are database state, not messages,
so there is nothing to acknowledge and a missed run simply catches up on the
next minute. Both actions are idempotent — an assigned ticket is no longer
pending, and a breach is stamped once per target. Assignment assumes a single
concurrent runner: the ticket row is locked, but two parallel workers could pass
an agent's load cap. `apps/next/supabase/schedule.sql` registers it as
`cofar-tickets-worker`, every minute, alongside the jobs worker.
