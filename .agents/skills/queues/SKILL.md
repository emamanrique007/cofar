---
name: queues
description: Implement or review Cofar PGMQ jobs, retries, visibility leases, cron routes and dead-letter handling.
---

# queues

Read enqueue_job, read_jobs, complete_job and fail_job plus queue.utils.ts together. PGMQ is the queue backend; no Redis worker is required.

Persist the job and enqueue in the same transaction. A unique request_id within the account makes producer retries idempotent. User producers verify membership. Only service_role can read/complete/fail; the HTTP entrypoint verifies a nonempty CRON_AUTH_SECRET using the existing constant-time helper.

The current lease is 120s and the route timeout 60s. Pass read_ct as a fencing receipt; stale workers cannot acknowledge. Current notification effects, status and archive are transactional. External effects need their own idempotency key before retries are safe; do not claim exactly-once delivery for network calls.

Retry with bounded exponential delay; after five attempts write DLQ and archive atomically. A failed DLQ write must retain the original message. Test poison payloads, stale receipts, duplicate delivery and tenant isolation. Queue internals stay outside exposed schemas. Scheduling is explicit via supabase/schedule.sql and Vault. Read docs/queues.md for operations.

Cron routes use `http.utils.ts` and `vCron` for request parsing, validation and response validation. Keep malformed JSON (400), invalid input (422), unauthorized calls (401) and internal failures (500) distinct. Never return raw database errors or request secrets. The jobs route returns `{ data: { read, completed, failed, stale } }`.
