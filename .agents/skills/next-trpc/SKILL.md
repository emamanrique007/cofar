---
name: next-trpc
description: Build Cofar Next App Router pages, typed tRPC endpoints and Supabase authentication flows.
---

# next-trpc

Read the relevant router, validation and UI caller together. Prefer Server Components; use client components for browser state and interactions. Use trpc hooks and TanStack Query for server state, React state for local UI, and Tailwind 4 for styling.

Get the verified user using Supabase auth.getUser(), never trust getSession() as authorization. The proxy refreshes cookies; the server/client/admin clients have distinct trust boundaries. Never import supabase.admin or env.server into client code. Put import "server-only" in server utilities.

Routers use userProcedure and the request-scoped user client. Validate inputs with Zod, return safe errors and let account RLS apply. Do not bypass RLS to make an endpoint work. Invalidate the relevant query after mutations. Include pending, error and empty states, labels and keyboard focus. Walk the actual UI flow after changes.

Place components under `components/<domain>/<Component>/` with matching PascalCase filenames and colocated helper/types files. Keep page files as composition entrypoints. Login uses its colocated server helper and `vAuth.login()`; do not place component-owned actions under app. HTTP routes use `api(request).input(schema).handle(handler)` from `http.utils.ts`, optionally `.output(schema)` for the data envelope; use `vCommon.inputs` and domain validations. The tRPC fetch adapter retains its own parsing/error protocol.
