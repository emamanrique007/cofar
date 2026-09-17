---
name: feature-docs
description: Document new API routes, background processors and substantial product features from their actual implementation.
---

# Feature documentation

Read the route, Zod input, database source definition and UI caller before documenting behavior. Every field, status, permission and example must correspond to real code.

For tRPC features document the procedure, input, account authorization and observable result in `docs/`. For cron/queues update `docs/queues.md` with retries, leases, idempotency and recovery steps. Internal worker routes are not public API endpoints.

Update README environment/setup instructions when a variable or command changes. Use `domain-modeling` only when terminology or an architecture decision changes. Do not create a separate documentation app or a public OpenAPI contract for internal tRPC procedures.
