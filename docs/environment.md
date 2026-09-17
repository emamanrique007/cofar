# Environment

`apps/next/.env.template` is the committed configuration contract; copy it to `.env.local` and fill only private local values there. `pnpm db:env` creates that file from the isolated local Supabase without printing credentials. `.env.test.template` documents test variables; never put test passwords in NEXT_PUBLIC variables.

`src/config/env.config.ts` defines publicEnvVariables, secretEnvVariables, envVariables and testEnvVariables. `src/types/env.types.ts` derives their TypeScript types. Raw ProcessEnv properties remain optional until validated by Zod.

Configuration reads values directly from `.env.local` or the deployment environment. Next validates public fields before build/dev/typegen. Server instrumentation validates the complete environment at startup; the service-role client revalidates before use. Browser clients validate only explicit NEXT_PUBLIC properties, which Next can inline safely. Secret rotation requires a process restart.

`pnpm test` uses deterministic non-production fixtures for schema checks; it does not load private .env.local. Browser tests require the local Cofar URL. Set both TEST_USER_EMAIL and TEST_USER_PASSWORD for an existing local user, or omit both to create and clean up a disposable account. Tests never create a user on a remote Supabase project.
