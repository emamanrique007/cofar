"use client";

import { weekdayLabels } from "@cofar/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

import { agentFormDefaults, agentFormSchema } from "./AgentForm.helpers";
import type { AgentFormInput, AgentFormOutput } from "./AgentForm.types";
import type { AgentFormProps } from "./AgentForm.types";
import { FormInput } from "@/components/form/FormInput/FormInput";
import { trpc } from "@/config/trpc.config";
import { Form } from "@/ui/form";
import { logFormErrors } from "@/utils/form.utils";

export const AgentForm = ({ accountId }: AgentFormProps) => {
  const utils = trpc.useUtils();
  const [created, setCreated] = useState("");
  const categories = trpc.tickets.categories.useQuery({ accountId });
  const resolver = zodResolver(agentFormSchema);
  const options = { resolver, defaultValues: agentFormDefaults };
  const form = useForm<AgentFormInput, unknown, AgentFormOutput>(options);
  const asAgent = form.watch("asAgent");

  const onCreated = async () => {
    setCreated(form.getValues("email"));
    form.reset(agentFormDefaults);
    await utils.agents.list.invalidate({ accountId });
  };

  const create = trpc.agents.create.useMutation({ onSuccess: onCreated });

  const submit: SubmitHandler<AgentFormOutput> = values => {
    const p1 = { accountId, name: values.name, email: values.email };
    const p2 = { password: values.password, asAgent: values.asAgent };
    const p3 = { timezone: values.timezone, days: values.days };
    const p4 = { start: values.start, end: values.end };
    const p5 = { maxOpen: values.maxOpen, autoAssign: values.autoAssign };
    const p6 = { categoryIds: values.categoryIds };

    create.mutate({ ...p1, ...p2, ...p3, ...p4, ...p5, ...p6 });
  };

  return (
    <section className="card">
      <h2 className="mb-1 text-xl font-semibold">Dar de alta a una persona</h2>
      <p className="mb-4 text-sm text-muted">
        Se crea el acceso con la contraseña que pongas acá. Si marcás que es
        agente, además le cargás el turno y las categorías que va a atender.
      </p>
      <Form {...form}>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(submit, logFormErrors)}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <FormInput control={form.control} label="Nombre" name="name" />
            <FormInput
              autoComplete="off"
              control={form.control}
              label="Correo"
              name="email"
              type="email"
            />
            <FormInput
              autoComplete="new-password"
              control={form.control}
              label="Contraseña"
              name="password"
              type="password"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("asAgent")} />
            Es agente de soporte
          </label>
          {asAgent ? (
            <div className="space-y-4 border-t border-line pt-4">
              <div className="grid gap-4 sm:grid-cols-4">
                <FormInput
                  control={form.control}
                  label="Huso horario"
                  name="timezone"
                />
                <FormInput
                  control={form.control}
                  label="Desde"
                  name="start"
                  type="time"
                />
                <FormInput
                  control={form.control}
                  label="Hasta"
                  name="end"
                  type="time"
                />
                <FormInput
                  control={form.control}
                  label="Tope de abiertos"
                  name="maxOpen"
                  type="number"
                  min={1}
                  max={100}
                />
              </div>
              <fieldset>
                <legend className="text-sm">Días de trabajo</legend>
                <div className="mt-2 flex flex-wrap gap-3">
                  {weekdayLabels.map((label, index) => {
                    return (
                      <label
                        key={label}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          value={index}
                          {...form.register("days")}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-sm">
                  Categorías que atiende (vacío significa todas)
                </legend>
                <div className="mt-2 flex flex-wrap gap-3">
                  {(categories.data ?? []).map(category => {
                    return (
                      <label
                        key={category.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          value={category.id}
                          {...form.register("categoryIds")}
                        />
                        {category.name}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...form.register("autoAssign")} />
                Recibe tickets por asignación automática
              </label>
            </div>
          ) : null}
          {create.error ? (
            <p role="alert" className="alert-error">
              {create.error.message}
            </p>
          ) : null}
          {created ? (
            <p role="status" className="alert-ok text-sm">
              Listo. {created} ya puede ingresar con esa contraseña.
            </p>
          ) : null}
          <button disabled={create.isPending} type="submit">
            Crear acceso
          </button>
        </form>
      </Form>
    </section>
  );
};
