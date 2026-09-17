---
name: quality
description: Run or change Cofar Turbo tasks, boundary checks, unit/integration tests, browser tests and CI.
---

# quality

Use pnpm with the packageManager version. pnpm check requires valid environment configuration but no running database: lint, boundaries, typecheck, unit tests, build. pnpm db:test uses real local PostgreSQL/PGMQ and pgTAP. pnpm e2e uses local Supabase plus Playwright. Avoid replacing integration behavior with mocks.

For isolated edits run the affected package first, then the aggregate gate if multiple packages changed. Tests must cover observable behavior, especially unauthorized access, cross-account operations, lease expiration and failure persistence.

Do not relax boundaries or disable TypeScript errors to pass a build. Include new packages in the dependency graph deliberately. Build outputs and .env files stay ignored. Report exactly which checks ran and which require missing services/credentials.
