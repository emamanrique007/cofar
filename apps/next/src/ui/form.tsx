"use client";

import { Slot } from "@radix-ui/react-slot";
import { createContext, useContext, useId } from "react";
import { Controller, FormProvider, useFormContext } from "react-hook-form";
import type { ControllerProps, FieldPath, FieldValues } from "react-hook-form";

import type { FormControlProps, FormDescriptionProps } from "./form.types";
import type { FormFieldContextValue } from "./form.types";
import type { FormItemContextValue, FormItemProps } from "./form.types";
import type { FormMessageProps } from "./form.types";
import { Label } from "./label";
import type { LabelProps } from "./label.types";
import { cn } from "./utils";

export const Form = FormProvider;

const FormFieldContext = createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
);

const FormItemContext = createContext<FormItemContextValue>(
  {} as FormItemContextValue
);

export const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(
  props: ControllerProps<TFieldValues, TName>
) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

export const useFormField = () => {
  const fieldContext = useContext(FormFieldContext);
  const itemContext = useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  if (!fieldContext.name) {
    throw new Error("useFormField should be used within <FormField>");
  }

  const fieldState = getFieldState(fieldContext.name, formState);
  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState
  };
};

export const FormItem = ({ ref, className, ...props }: FormItemProps) => {
  const id = useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div ref={ref} className={cn("space-y-2", className)} {...props} />
    </FormItemContext.Provider>
  );
};

export const FormLabel = ({ ref, className, ...props }: LabelProps) => {
  const { error, formItemId } = useFormField();
  const errorClass = error ? "text-red-800" : "";

  return (
    <Label
      ref={ref}
      className={cn(errorClass, className)}
      htmlFor={formItemId}
      {...props}
    />
  );
};

export const FormControl = ({ ref, ...props }: FormControlProps) => {
  const formField = useFormField();
  const errorDescribedBy = `${formField.formDescriptionId} ${formField.formMessageId}`;
  let describedBy = formField.formDescriptionId;

  if (formField.error) {
    describedBy = errorDescribedBy;
  }

  return (
    <Slot
      ref={ref}
      id={formField.formItemId}
      aria-describedby={describedBy}
      aria-invalid={!!formField.error}
      {...props}
    />
  );
};

export const FormDescription = (props: FormDescriptionProps) => {
  const { ref, className, ...rest } = props;
  const { formDescriptionId } = useFormField();

  if (!rest.children) {
    return null;
  }

  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn("text-sm text-slate-600", className)}
      {...rest}
    />
  );
};

export const FormMessage = (props: FormMessageProps) => {
  const { ref, className, children, ...rest } = props;
  const { error, formMessageId } = useFormField();
  const body = error ? String(error.message) : children;

  if (!body) {
    return null;
  }

  return (
    <p
      ref={ref}
      id={formMessageId}
      role="alert"
      className={cn("FormError mt-2 text-sm text-red-800", className)}
      {...rest}
    >
      {body}
    </p>
  );
};
