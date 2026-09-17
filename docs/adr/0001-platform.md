# 0001 — Cofar platform

Status: accepted.

Cofar uses pnpm workspaces with Turborepo, one Next App Router application, typed tRPC routes, and compiled shared packages. Supabase owns Auth, PostgreSQL, RLS, Storage and Realtime. PGMQ provides durable queues in the same database; pg_cron invokes authenticated Next routes through pg_net.

This keeps enqueueing and application state transactional and avoids a second queue datastore. SQL permissions, request authentication and server-only imports are all required. External side effects still require idempotency at their destination.

Packages expose compiled ESM and declarations through TypeScript compilation. SDKs and additional applications are introduced when there is a concrete consumer; no empty apps are shipped. The initial functional slice is account creation → enqueue notification → worker completion.

Environment values come directly from `.env.local` or the deployment platform. Public values are validated before build; private values are validated at server startup and never injected into the browser environment. Secret rotation requires a process restart.

Verification: pnpm check, pnpm db:test, pnpm e2e.
