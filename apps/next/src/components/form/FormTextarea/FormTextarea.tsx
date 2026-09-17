"use client";

import type { FieldValues } from "react-hook-form";
import { twMerge } from "tailwind-merge";

import type { FormTextareaProps } from "./FormTextarea.types";
import { FormControl, FormDescription, FormField } from "@/ui/form";
import { FormItem, FormLabel, FormMessage } from "@/ui/form";
import { Textarea } from "@/ui/textarea";

export const FormTextarea = <TSchema extends FieldValues>(
  props: FormTextareaProps<TSchema>
) => {
  const { className, description, control, messageClassName, ...rest } = props;
  const { labelClassName, descriptionClassName, label, name, ...rest2 } = rest;

  return (
    <FormField
      control={control}
      name={name}
      defaultValue={rest2.defaultValue}
      render={fieldProps => {
        const { field } = fieldProps;
        const sanitizedValue = field.value ?? "";

        return (
          <FormItem className="FormTextareaWrapper">
            <FormLabel className={twMerge("FormTextareaLabel", labelClassName)}>
              {label}
            </FormLabel>
            <FormControl>
              <Textarea
                className={twMerge("FormTextarea mt-2", className)}
                {...rest2}
                {...field}
                value={sanitizedValue}
              />
            </FormControl>
            <FormDescription
              className={twMerge(
                "FormTextareaDescription",
                descriptionClassName
              )}
            >
              {description}
            </FormDescription>
            <FormMessage className={twMerge("FormError", messageClassName)} />
          </FormItem>
        );
      }}
    />
  );
};
