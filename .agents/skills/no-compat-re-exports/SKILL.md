---
name: no-compat-re-exports
description: >-
  Forbids compatibility re-exports in component helpers when moving code to
  utils. Use when refactoring helpers, moving symbols to @/utils, reviewing PRs
  with export { x } from in *.helpers.ts, or when the user mentions re-exports,
  barrel compatibility, or "nada de esto" on helper files.
---

# No compatibility re-exports

## Rule

**Never add re-exports to keep old import paths working.**

When moving helpers to `@/utils` (or any shared module), **update every import
site** to the new path. Do not leave passthrough lines like:

```ts
// ❌ Forbidden in *.helpers.ts / *.helpers.tsx
export { getInAppFormProfile } from "@/utils/inappTemplateForm.utils";
export { getMessageTypeMeta } from "@/utils/inappTemplateForm.utils";
export type { InAppFormProfile } from "@/utils/inappTemplateForm.utils";
```

This pattern is a Cursor refactor shortcut. It hides the real source, creates
dead barrels, and violates how this repo organizes code.

## What belongs in component helpers

A component `*.helpers.ts` file may only contain logic **owned by that
component**:

- Form `schema`, `defaultValues`, mappers local to the form
- Table column builders, filter options tied to that table
- Constants used only by that component tree

Shared domain logic belongs in `@/utils`, `@/validations`, or `packages/`.
Consumers import from there directly.

## Refactor workflow

1. Move the implementation to the shared module (e.g. `@/utils/foo.utils.ts`).
2. `rg` for old import paths and symbols; update each file to the new path.
3. Delete moved code from the helper — **do not** add `export { … } from`.
4. Run tests / typecheck on touched areas.

## Correct vs incorrect

```ts
// ❌ Moved to utils but kept compatibility barrel in helper
// InAppTemplateForm.helpers.ts
export { messageTypeOptions } from "@/utils/inappTemplateForm.utils";

// ✅ Helper keeps only form-local values
export const schema = vInAppTemplate.form();
export const defaultValues = { name: "", status: "ACTIVE", ... };

// ✅ Consumer imports shared util directly
import { messageTypeOptions } from "@/utils/inappTemplateForm.utils";
```

## Scope

- Apply to `**/*.helpers.ts` and `**/*.helpers.tsx` under `apps/` and
  `packages/`.
- Does **not** forbid intentional public API barrels at package entry points
  (e.g. `sdk/rn/src/index.ts`) when that is the designed surface.

## Checklist before finishing

- [ ] No `export { … } from "@/…"` passthroughs added to component helpers
- [ ] No `export type { … } from "@/…"` passthroughs in component helpers
- [ ] All call sites import shared symbols from their canonical module
- [ ] Helper file only exports component-local definitions

## More examples

See [examples.md](examples.md) for before/after from this codebase.
