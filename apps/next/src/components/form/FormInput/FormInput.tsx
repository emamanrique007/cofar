"use client";

import type { ChangeEvent, FocusEvent } from "react";
import type { FieldValues } from "react-hook-form";
import { twMerge } from "tailwind-merge";

import type { FormInputProps } from "./FormInput.types";
import { FormControl, FormDescription, FormField } from "@/ui/form";
import { FormItem, FormLabel, FormMessage } from "@/ui/form";
import { Input } from "@/ui/input";

export const FormInput = <TSchema extends FieldValues>(
  props: FormInputProps<TSchema>
) => {
  const { className, description, control, messageClassName, ...rest } = props;
  const { labelClassName, descriptionClassName, label, name, ...rest2 } = rest;
  const { wrapperClassName, disabled, ...rest3 } = rest2;

  return (
    <FormField
      control={control}
      name={name}
      defaultValue={rest3.defaultValue}
      render={fieldProps => {
        const { field } = fieldProps;
        const sanitizedValue = field.value ?? "";

        const focusHandler = (event: FocusEvent<HTMLInputElement>) => {
          rest3.onFocus?.(event);

          if (event.target.type === "number") {
            event.target.select();
          }
        };

        const blurHandler = (event: FocusEvent<HTMLInputElement>) => {
          rest3.onBlur?.(event);
          field.onBlur();
        };

        const changeHandler = (event: ChangeEvent<HTMLInputElement>) => {
          rest3.onChange?.(event);
          field.onChange(event);
        };

        return (
          <FormItem className={twMerge("FormInputWrapper", wrapperClassName)}>
            <FormLabel
              className={twMerge("FormInputLabel", labelClassName)}
              htmlFor={name}
            >
              {label}
            </FormLabel>
            <FormControl>
              <Input
                id={name}
                className={twMerge("FormInput mt-2", className)}
                {...rest3}
                {...field}
                disabled={disabled ?? field.disabled}
                value={sanitizedValue}
                onFocus={focusHandler}
                onBlur={blurHandler}
                onChange={changeHandler}
              />
            </FormControl>
            {rest3.type !== "hidden" ? (
              <FormDescription
                className={twMerge(
                  "FormInputDescription",
                  descriptionClassName
                )}
              >
                {description}
              </FormDescription>
            ) : null}
            <FormMessage className={twMerge("FormError", messageClassName)} />
          </FormItem>
        );
      }}
    />
  );
};
