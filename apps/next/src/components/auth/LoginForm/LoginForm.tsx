"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

import { login } from "./LoginForm.helpers";
import type { SchemaInput, SchemaOutput } from "./LoginForm.types";
import { FormInput } from "@/components/form/FormInput/FormInput";
import { useScrollToError } from "@/hooks/useScrollToError";
import { Form } from "@/ui/form";
import { logFormErrors } from "@/utils/form.utils";
import { vAuth } from "@/validations/auth.validations";

const schema = vAuth.login();
const defaultValues = { email: "", password: "" };

export const LoginForm = () => {
  const [state, action, busy] = useActionState(login, { error: "" });
  const formOptions = { resolver: zodResolver(schema), defaultValues };
  const form = useForm<SchemaInput, unknown, SchemaOutput>(formOptions);

  useScrollToError(form.formState.errors);

  const submitHandler: SubmitHandler<SchemaOutput> = values => {
    const data = new FormData();

    data.set("email", values.email);
    data.set("password", values.password);
    startTransition(() => {
      action(data);
    });
  };

  const label = busy ? "Ingresando…" : "Ingresar";

  return (
    <Form {...form}>
      <form
        noValidate
        className="space-y-5"
        onSubmit={form.handleSubmit(submitHandler, logFormErrors)}
      >
        <FormInput
          autoComplete="email"
          control={form.control}
          label="Correo electrónico"
          name="email"
          type="email"
        />
        <FormInput
          autoComplete="current-password"
          control={form.control}
          label="Contraseña"
          name="password"
          type="password"
        />
        {state.error ? <p role="alert">{state.error}</p> : null}
        <button disabled={busy} type="submit">
          {label}
        </button>
        <p className="text-sm text-muted">
          Solicitá tu acceso al administrador.
        </p>
      </form>
    </Form>
  );
};
