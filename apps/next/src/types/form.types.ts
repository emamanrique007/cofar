import type { ReactNode } from "react";
import type { Control, FieldValues, Path, PathValue } from "react-hook-form";

export interface SelectOption {
  label: string;
  value: string;
}

export type SelectValue = string | SelectOption;

export interface FormFieldProps<TSchema extends FieldValues> {
  className?: string;
  label?: ReactNode;
  labelClassName?: string;
  messageClassName?: string;
  descriptionClassName?: string;
  wrapperClassName?: string;
  name: Path<TSchema>;
  control: Control<TSchema>;
  description?: ReactNode;
  defaultValue?: PathValue<TSchema, Path<TSchema>>;
  defaultChecked?: PathValue<TSchema, Path<TSchema>>;
}
