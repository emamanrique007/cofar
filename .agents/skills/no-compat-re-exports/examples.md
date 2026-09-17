# Examples — no compatibility re-exports

## InAppTemplateForm: moved utils left as passthrough barrel

Illustrative refactor. Logic moved to `@/utils/inappTemplateForm.utils` but
the helper kept re-exports "for compatibility". No consumer used them.

```ts
// ❌ Before — InAppTemplateForm.helpers.ts
import { vInAppTemplate } from "@/validations/marketing-automation/inappTemplate.validations";

export const schema = vInAppTemplate.form();
export const defaultValues = { name: "", status: "ACTIVE", ... };

export { getInAppFormProfile } from "@/utils/inappTemplateForm.utils";
export { getMessageTypeMeta } from "@/utils/inappTemplateForm.utils";
export { messageTypeOptions } from "@/utils/inappTemplateForm.utils";
export type { InAppFormProfile } from "@/utils/inappTemplateForm.utils";

// ✅ After — helper only owns form-local config
import { vInAppTemplate } from "@/validations/marketing-automation/inappTemplate.validations";

export const schema = vInAppTemplate.form();
export const defaultValues = { name: "", status: "ACTIVE", ... };
```

Consumers already import from the canonical module:

```ts
// ✅ MessageTypeSelect.tsx
// ✅ InAppTemplateForm.tsx — only form-local symbols from helper
import { defaultValues, schema } from "./InAppTemplateForm.helpers";
import { getMessageTypeMeta } from "@/utils/inappTemplateForm.utils";
import { messageTypeOptions } from "@/utils/inappTemplateForm.utils";
// ✅ InAppEditorForm.tsx
import { getInAppFormProfile } from "@/utils/inappTemplateForm.utils";
```

## Refactor workflow: move + update imports (no barrel)

```ts
// Step 1 — extract implementation to shared module
// @/utils/pushTemplateForm.utils.ts
export const getPushPreviewTitle = (title?: string) => title?.trim() ?? "";

// Step 2 — rg and update every import site
// ❌ Do not leave this in PushTemplateForm.helpers.ts
export { getPushPreviewTitle } from "@/utils/pushTemplateForm.utils";

// ✅ PushTemplateForm.helpers.ts keeps only form schema/defaults
export const schema = vPushTemplate.form();
export const defaultValues = { title: "", text: "", ... };

// ✅ Preview component imports directly
import { getPushPreviewTitle } from "@/utils/pushTemplateForm.utils";
```

## Type re-exports are also forbidden

```ts
// ✅ Import type at the consumer
import type { InAppFormProfile } from "@/utils/inappTemplateForm.utils";

// ❌ Passthrough type in component helper
export type { InAppFormProfile } from "@/utils/inappTemplateForm.utils";
```

## Multiple symbols from the same utils file

```ts
// ✅ Single import line at each consumer (alphabetical per project rules)
import {
  getInAppFormProfile,
  getMessageTypeMeta
} from "@/utils/inappTemplateForm.utils";
import { messageTypeOptions } from "@/utils/inappTemplateForm.utils";

// ❌ One re-export line per symbol (noise, dead barrel)
export { getInAppFormProfile } from "@/utils/inappTemplateForm.utils";
export { getMessageTypeMeta } from "@/utils/inappTemplateForm.utils";
export { messageTypeOptions } from "@/utils/inappTemplateForm.utils";
```

If the combined import exceeds 80 columns, duplicate import lines — never a
helper re-export.

## What stays in a component helper

```ts
// ✅ Table helpers — columns/filters for that table only
export const getColumns = (accountId: string) => [ ... ];
export const filterOptions = ["ACTIVE", "INACTIVE"] as const;

// ✅ Form helpers — schema + defaults for that form only
export const schema = vInAppTemplate.form();
export const defaultValues = { name: "", message_type: "modal" as const, ... };

// ✅ Mapper used only when submitting this form
export const toPayload = (values: Schema) => {
  const body1 = { name: values.name, status: values.status };
  return body1;
};
```

## Allowed: intentional package public API

Not the same as a compatibility barrel in a component helper.

```ts
// ✅ sdk/rn/src/index.ts — designed public surface for the package
export { InAppProvider } from "inapp/ui/InAppProvider/InAppProvider";
export type { InAppProviderProps } from "inapp/ui/InAppProvider/InAppProvider.types";
```

Rule of thumb: package `index.ts` is the product API; `Component.helpers.ts` is
not.

## Review comment triggers

When you see PR feedback like:

- "nada de esto, esto lo hace cursor cuando quieres cambiar algo"
- "arregla los re-exports de compatibilidad"
- "importa directo del utils"

Apply this skill: delete passthrough exports, `rg` symbols, fix import paths.
