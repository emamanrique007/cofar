"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

import { ticketFormDefaults, ticketFormSchema } from "./TicketForm.helpers";
import type { TicketFormInput, TicketFormOutput } from "./TicketForm.types";
import type { TicketFormProps, TicketFormResult } from "./TicketForm.types";
import { FormInput } from "@/components/form/FormInput/FormInput";
import { FormSelect } from "@/components/form/FormSelect/FormSelect";
import { FormTextarea } from "@/components/form/FormTextarea/FormTextarea";
import { trpc } from "@/config/trpc.config";
import { useScrollToError } from "@/hooks/useScrollToError";
import type { TicketCreated } from "@/types/ticket.types";
import { Form } from "@/ui/form";
import { logFormErrors } from "@/utils/form.utils";
import { formatMinutes } from "@/utils/format.utils";

export const TicketForm = ({ accountId }: TicketFormProps) => {
  const utils = trpc.useUtils();
  const [result, setResult] = useState<TicketFormResult | null>(null);
  const categories = trpc.tickets.categories.useQuery({ accountId });
  const policies = trpc.tickets.policies.useQuery({ accountId });
  const resolver = zodResolver(ticketFormSchema);
  const formOptions = { resolver, defaultValues: ticketFormDefaults };
  const form = useForm<TicketFormInput, unknown, TicketFormOutput>(formOptions);
  const selectedId = form.watch("categoryId");

  useScrollToError(form.formState.errors);

  const selected = categories.data?.find(item => {
    return item.id === selectedId;
  });
  const priority = selected?.default_priority ?? "normal";
  const policy = policies.data?.find(item => {
    return item.priority === priority;
  });
  const options = (categories.data ?? []).map(item => {
    return { value: item.id, label: item.name };
  });
  const promise = selected ? policy : undefined;

  const onCreated = async (created: TicketCreated) => {
    const categoryName = created.ticket.category ?? "Sin clasificar";

    setResult({ categoryName, number: created.ticket.number });
    form.reset(ticketFormDefaults);
    await utils.tickets.list.invalidate();
  };

  const create = trpc.tickets.create.useMutation({ onSuccess: onCreated });

  const submit: SubmitHandler<TicketFormOutput> = values => {
    const p1 = { accountId, title: values.title };
    const p2 = {
      description: values.description,
      categoryId: values.categoryId
    };

    create.mutate({ ...p1, ...p2 });
  };

  return (
    <section className="card">
      <h2 className="mb-1 text-xl font-semibold">Nueva solicitud</h2>
      <p className="mb-4 text-sm text-muted">
        Elegí la categoría que mejor describa lo que necesitás. De la categoría
        salen la prioridad y el tiempo de respuesta que te prometemos.
      </p>
      <Form {...form}>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(submit, logFormErrors)}
        >
          <FormInput
            control={form.control}
            label="Título"
            name="title"
            placeholder="No puedo ingresar al sistema"
          />
          <FormTextarea
            control={form.control}
            label="Descripción"
            name="description"
            rows={5}
            placeholder="Contá qué pasó, desde cuándo y qué intentaste."
          />
          <FormSelect
            control={form.control}
            label="Categoría"
            name="categoryId"
            options={options}
            placeholder="Elegí una categoría"
          />
          {promise ? (
            <p className="text-sm text-muted">
              Compromiso para esta categoría: primera respuesta en{" "}
              {formatMinutes(promise.first_response_minutes)} y resolución en{" "}
              {formatMinutes(promise.resolution_minutes)}.
            </p>
          ) : null}
          {create.error ? (
            <p role="alert" className="alert-error">
              {create.error.message}
            </p>
          ) : null}
          <button disabled={create.isPending} type="submit">
            Crear solicitud
          </button>
        </form>
      </Form>
      {result ? (
        <p role="status" className="alert-ok mt-4 text-sm">
          Solicitud #{result.number} creada en{" "}
          <strong>{result.categoryName}</strong>. Un agente la va a tomar desde
          la cola.
        </p>
      ) : null}
    </section>
  );
};
