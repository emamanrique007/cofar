---
name: cofar
description: Implement Cofar features and choose their placement in the pnpm/Turbo/Next/Supabase workspace.
---

# cofar

Trace UI → tRPC → Supabase/RLS → queue before changing a flow. Search existing utilities before introducing a dependency.

Applications live in apps/next. Shared compiled packages are @cofar/types, @cofar/utils and @cofar/builders. Dependencies flow types → utils → builders. Use workspace:* dependencies and public package exports.

Use pnpm dev and pnpm check. Do not generate a second workspace or substitute Nx, Angular, Nest, Redis, BullMQ or a separate API server for the current stack. Add product-specific modules only when requested. Do not create empty applications or compatibility re-export files.

Match the existing vertical slices: validation schema, router, utility where needed, component, migration for persistence. Keep user data behind authentication and account RLS. Follow the relevant SQL/queue skill for cross-cutting changes. Use the downloaded skills under their original names as routed by AGENTS.md.

Components live at `components/<domain>/<Component>/<Component>.tsx`, with component-owned `*.helpers.ts` and `*.types.ts` beside them when needed. Current domains are auth, dashboard and global. Pages compose components; components never import implementations from app routes. Component-owned Server Functions live in their helper with `"use server"`; shared logic belongs in utils/validations. No compatibility barrels.
