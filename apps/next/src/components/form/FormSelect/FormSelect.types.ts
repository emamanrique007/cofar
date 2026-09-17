import type { ComponentProps } from "react";
import type { FieldValues } from "react-hook-form";

import type { FormFieldProps, SelectOption } from "@/types/form.types";

export interface FormSelectProps<TSchema extends FieldValues>
  extends
    FormFieldProps<TSchema>,
    Omit<
      ComponentProps<"select">,
      "name" | "defaultChecked" | "defaultValue" | "children"
    > {
  options: SelectOption[];
  placeholder?: string;
}
