import type { ComponentProps } from "react";
import type { FieldValues } from "react-hook-form";

import type { FormFieldProps } from "@/types/form.types";

export interface FormInputProps<TSchema extends FieldValues>
  extends
    FormFieldProps<TSchema>,
    Omit<ComponentProps<"input">, "name" | "defaultChecked" | "defaultValue"> {}
