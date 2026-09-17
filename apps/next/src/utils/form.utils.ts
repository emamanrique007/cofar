import type { FormEvent } from "react";
import type { FieldErrors, FieldValues } from "react-hook-form";

export const stopFormPropagate = (callback: () => void) => {
  return (event: FormEvent) => {
    event.stopPropagation();
    event.preventDefault();
    callback();
  };
};

const fieldErrorMessage = (error: unknown) => {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message ?? "Validation error");
  }

  return "Validation error";
};

const fieldErrorType = (error: unknown) => {
  if (error && typeof error === "object" && "type" in error) {
    return String(error.type ?? "unknown");
  }

  return "unknown";
};

export const logFormErrors = <T extends FieldValues>(
  errors: FieldErrors<T>
) => {
  try {
    const entries = Object.entries(errors).map(([field, error]) => {
      const message = fieldErrorMessage(error);
      const type = fieldErrorType(error);

      return { field, message, type };
    });

    console.error("Form validation errors:", entries);
  } catch (error) {
    console.error("Error logging form validation errors:", error);
  }
};
