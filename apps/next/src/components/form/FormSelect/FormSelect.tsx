"use client";

import type { FieldValues } from "react-hook-form";
import { twMerge } from "tailwind-merge";

import type { FormSelectProps } from "./FormSelect.types";
import { FormControl, FormDescription, FormField } from "@/ui/form";
import { FormItem, FormLabel, FormMessage } from "@/ui/form";
import { Select } from "@/ui/select";

export const FormSelect = <TSchema extends FieldValues>(
  props: FormSelectProps<TSchema>
) => {
  const { className, description, control, messageClassName, ...rest } = props;
  const { labelClassName, descriptionClassName, label, name, ...rest2 } = rest;
  const { wrapperClassName, options, placeholder, ...rest3 } = rest2;

  return (
    <FormField
      control={control}
      name={name}
      render={fieldProps => {
        const { field } = fieldProps;

        return (
          <FormItem className={twMerge("FormSelectWrapper", wrapperClassName)}>
            <FormLabel
              className={twMerge("FormSelectLabel", labelClassName)}
              htmlFor={name}
            >
              {label}
            </FormLabel>
            <FormControl>
              <Select
                id={name}
                className={twMerge("FormSelect mt-2", className)}
                {...rest3}
                {...field}
                value={field.value ?? ""}
              >
                {placeholder ? <option value="">{placeholder}</option> : null}
                {options.map(option => {
                  return (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  );
                })}
              </Select>
            </FormControl>
            <FormDescription
              className={twMerge("FormSelectDescription", descriptionClassName)}
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
