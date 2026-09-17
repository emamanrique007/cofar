"use client";

import { jobStatusLabels } from "@cofar/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

import { createAccountDefaults } from "./Dashboard.helpers";
import { createAccountSchema } from "./Dashboard.helpers";
import { enqueueJobDefaults } from "./Dashboard.helpers";
import { enqueueJobSchema } from "./Dashboard.helpers";
import type { CreateAccountOutput } from "./Dashboard.types";
import type { DashboardProps } from "./Dashboard.types";
import type { EnqueueJobOutput } from "./Dashboard.types";
import { FormInput } from "@/components/form/FormInput/FormInput";
import { trpc } from "@/config/trpc.config";
import { useScrollToError } from "@/hooks/useScrollToError";
import { Form } from "@/ui/form";
import { logFormErrors } from "@/utils/form.utils";
import { createBrowserClient } from "@/utils/supabase/supabase.client";

export const Dashboard = ({ email }: DashboardProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();
  const [selected, setSelected] = useState("");
  const [sessionError, setSessionError] = useState("");
  const accounts = trpc.accounts.list.useQuery();
  const accountId = selected || accounts.data?.[0]?.id || "";
  const queryOptions = { enabled: !!accountId, refetchInterval: 5000 };
  const jobs = trpc.jobs.list.useQuery({ accountId }, queryOptions);
  const createResolver = zodResolver(createAccountSchema);
  const enqueueResolver = zodResolver(enqueueJobSchema);
  const createP1 = { resolver: createResolver };
  const createP2 = { defaultValues: createAccountDefaults };
  const enqueueP1 = { resolver: enqueueResolver };
  const enqueueP2 = { defaultValues: enqueueJobDefaults };
  const createFormOptions = { ...createP1, ...createP2 };
  const enqueueFormOptions = { ...enqueueP1, ...enqueueP2 };
  const createForm = useForm(createFormOptions);
  const enqueueForm = useForm(enqueueFormOptions);

  useScrollToError(createForm.formState.errors);
  useScrollToError(enqueueForm.formState.errors);

  const onAccountCreated = async (id: string) => {
    setSelected(id);
    await utils.accounts.list.invalidate();
  };

  const onJobQueued = () => {
    return utils.jobs.list.invalidate();
  };

  const createOptions = { onSuccess: onAccountCreated };
  const enqueueOptions = { onSuccess: onJobQueued };
  const create = trpc.accounts.create.useMutation(createOptions);
  const enqueue = trpc.jobs.enqueue.useMutation(enqueueOptions);

  const createAccount: SubmitHandler<CreateAccountOutput> = values => {
    create.mutate({ name: values.name });
  };

  const enqueueJob: SubmitHandler<EnqueueJobOutput> = values => {
    const requestId = crypto.randomUUID();
    const body = { accountId, requestId, message: values.message };

    enqueue.mutate(body);
  };

  const logout = async () => {
    try {
      const { error } = await createBrowserClient().auth.signOut();

      if (error) {
        throw error;
      }

      queryClient.clear();
      router.replace("/login");
      router.refresh();
    } catch {
      setSessionError("No se pudo cerrar la sesión.");
    }
  };

  const error = accounts.error || jobs.error || create.error || enqueue.error;
  const createSubmit = createForm.handleSubmit(createAccount, logFormErrors);
  const enqueueSubmit = enqueueForm.handleSubmit(enqueueJob, logFormErrors);

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-bold tracking-widest">COFAR</p>
          <p className="mt-1 text-sm">{email}</p>
        </div>
        <button onClick={logout}>Cerrar sesión</button>
      </header>
      <h1 className="text-3xl font-semibold">Mi espacio de trabajo</h1>
      {error || sessionError ? (
        <p role="alert" className="rounded bg-red-50 p-4 text-red-800">
          {sessionError || error?.message}
        </p>
      ) : null}
      {accounts.isLoading ? <p role="status">Cargando cuentas…</p> : null}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">Cuentas</h2>
        {!!accounts.data?.length ? (
          <label className="mb-6 block">
            Cuenta activa
            <select
              value={accountId}
              onChange={event => {
                return setSelected(event.target.value);
              }}
            >
              {accounts.data.map(account => {
                return (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                );
              })}
            </select>
          </label>
        ) : null}
        <Form {...createForm}>
          <form
            noValidate
            className="flex flex-wrap items-end gap-3"
            onSubmit={createSubmit}
          >
            <FormInput
              className="grow"
              control={createForm.control}
              label="Nueva cuenta"
              name="name"
              wrapperClassName="grow"
            />
            <button disabled={create.isPending}>Crear cuenta</button>
          </form>
        </Form>
      </section>
      {accountId ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold">
            Trabajos en segundo plano
          </h2>
          <p className="mb-4 text-slate-600">
            Enviá un mensaje de prueba. Se guardará como notificación cuando se
            procese.
          </p>
          <Form {...enqueueForm}>
            <form noValidate className="space-y-3" onSubmit={enqueueSubmit}>
              <FormInput
                control={enqueueForm.control}
                label="Mensaje"
                name="message"
              />
              <button disabled={enqueue.isPending}>Enviar a la cola</button>
            </form>
          </Form>
          <ul aria-live="polite" className="mt-6 divide-y divide-slate-200">
            {jobs.data?.map(job => {
              return (
                <li key={job.id} className="flex justify-between gap-4 py-3">
                  <span>{job.body}</span>
                  <span>{jobStatusLabels[job.status]}</span>
                </li>
              );
            })}
          </ul>
          {jobs.data?.length === 0 ? (
            <p className="mt-5 text-slate-500">Todavía no hay trabajos.</p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
};
