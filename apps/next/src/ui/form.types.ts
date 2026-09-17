import type { Slot } from "@radix-ui/react-slot";
import type { ComponentProps, HTMLAttributes, RefObject } from "react";
import type { FieldPath, FieldValues } from "react-hook-form";

export interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  name: TName;
}

export interface FormItemContextValue {
  id: string;
}

export interface FormItemProps extends HTMLAttributes<HTMLDivElement> {
  ref?: RefObject<HTMLDivElement | null>;
}

export interface FormDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  ref?: RefObject<HTMLParagraphElement | null>;
}

export interface FormMessageProps extends HTMLAttributes<HTMLParagraphElement> {
  ref?: RefObject<HTMLParagraphElement | null>;
}

export type FormControlProps = ComponentProps<typeof Slot>;
