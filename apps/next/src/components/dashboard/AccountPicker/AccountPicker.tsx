"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

import { accountDefaults, accountSchema } from "./AccountPicker.helpers";
import type { AccountPickerProps } from "./AccountPicker.types";
import { FormInput } from "@/components/form/FormInput/FormInput";
import { trpc } from "@/config/trpc.config";
import { Form } from "@/ui/form";
import { logFormErrors } from "@/utils/form.utils";

export const AccountPicker = (props: AccountPickerProps) => {
  const { accounts, activeId } = props;
  const router = useRouter();
  const resolver = zodResolver(accountSchema);
  const formOptions = { resolver, defaultValues: accountDefaults };
  const form = useForm(formOptions);

  const enter = (accountId: string) => {
    router.push(`/tickets?account=${accountId}`);
  };

  const onCreated = (accountId: string) => {
    form.reset(accountDefaults);
    router.push(`/tickets?account=${accountId}`);
    router.refresh();
  };

  const create = trpc.accounts.create.useMutation({ onSuccess: onCreated });

  const submit: SubmitHandler<{ name: string }> = values => {
    create.mutate({ name: values.name });
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-1 text-xl font-semibold">Elegí un espacio</h2>
        <p className="mb-4 text-muted">
          Cada espacio tiene su propia mesa de ayuda, su equipo y sus acuerdos
          de servicio.
        </p>
        {accounts.length ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {accounts.map(account => {
              const owner = account.role === "owner";
              const active = account.id === activeId;

              return (
                <li key={account.id}>
                  <button
                    className="tile"
                    onClick={() => {
                      return enter(account.id);
                    }}
                  >
                    <span className="block text-lg font-semibold text-navy">
                      {account.name}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="badge badge-neutral">
                        {owner ? "Administrador" : "Integrante"}
                      </span>
                      {active ? <span className="badge">Activo</span> : null}
                    </span>
                    <span className="mt-3 block text-sm text-muted">
                      Entrar a la mesa de ayuda
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted">
            Todavía no pertenecés a ningún espacio. Creá el primero acá abajo.
          </p>
        )}
      </section>
      <section className="card">
        <h2 className="mb-1 text-xl font-semibold">Crear un espacio</h2>
        <p className="mb-4 text-sm text-muted">
          Al crearlo se cargan las categorías, las reglas de clasificación y los
          acuerdos de SLA por prioridad, y quedás como su primer agente.
        </p>
        <Form {...form}>
          <form
            noValidate
            className="flex flex-wrap items-end gap-3"
            onSubmit={form.handleSubmit(submit, logFormErrors)}
          >
            <FormInput
              className="grow"
              control={form.control}
              label="Nombre del espacio"
              name="name"
              placeholder="Soporte interno"
              wrapperClassName="grow"
            />
            <button disabled={create.isPending} type="submit">
              Crear espacio
            </button>
          </form>
        </Form>
        {create.error ? (
          <p role="alert" className="alert-error mt-3">
            {create.error.message}
          </p>
        ) : null}
      </section>
    </div>
  );
};
