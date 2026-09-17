import type { ComponentProps } from "react";
import type { FieldValues } from "react-hook-form";

import type { FormFieldProps } from "@/types/form.types";

export interface FormTextareaProps<TSchema extends FieldValues>
  extends
    FormFieldProps<TSchema>,
    Omit<
      ComponentProps<"textarea">,
      "name" | "defaultChecked" | "defaultValue"
    > {}
