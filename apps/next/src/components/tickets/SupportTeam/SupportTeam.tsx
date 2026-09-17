"use client";

import { ticketAvailabilityLabels } from "@cofar/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

import { inviteDefaults, inviteSchema } from "./SupportTeam.helpers";
import { roleLabels } from "./SupportTeam.helpers";
import type { InviteOutput, SupportTeamProps } from "./SupportTeam.types";
import { FormInput } from "@/components/form/FormInput/FormInput";
import { AgentForm } from "@/components/tickets/AgentForm/AgentForm";
import { AgentShift } from "@/components/tickets/AgentShift/AgentShift";
import { trpc } from "@/config/trpc.config";
import { Form } from "@/ui/form";
import { logFormErrors } from "@/utils/form.utils";

export const SupportTeam = ({ accountId, isOwner }: SupportTeamProps) => {
  const utils = trpc.useUtils();
  const team = trpc.agents.list.useQuery({ accountId });
  const resolver = zodResolver(inviteSchema);
  const options = { resolver, defaultValues: inviteDefaults };
  const form = useForm(options);

  const onChanged = async () => {
    form.reset(inviteDefaults);
    await utils.agents.list.invalidate({ accountId });
  };

  const invite = trpc.agents.invite.useMutation({ onSuccess: onChanged });
  const setAgent = trpc.agents.setAgent.useMutation({ onSuccess: onChanged });

  const submit: SubmitHandler<InviteOutput> = values => {
    const body = { accountId, email: values.email };

    invite.mutate({ ...body, asAgent: values.asAgent });
  };

  const failure = team.error ?? invite.error ?? setAgent.error;

  return (
    <div className="space-y-6">
      <AgentShift accountId={accountId} />
      {isOwner ? <AgentForm accountId={accountId} /> : null}
      {isOwner ? (
        <section className="card">
          <h2 className="mb-1 text-xl font-semibold">
            Sumar a alguien que ya tiene acceso
          </h2>
          <p className="mb-4 text-sm text-muted">
            Para quien ya entró alguna vez a Cofar, por ejemplo desde otro
            espacio. Sin marcar la casilla entra como solicitante.
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
                label="Correo electrónico"
                name="email"
                type="email"
                wrapperClassName="grow"
              />
              <label className="flex items-center gap-2 pb-3 text-sm">
                <input
                  className="w-auto"
                  type="checkbox"
                  {...form.register("asAgent")}
                />
                Es agente de soporte
              </label>
              <button disabled={invite.isPending} type="submit">
                Sumar
              </button>
            </form>
          </Form>
        </section>
      ) : null}
      <section className="card">
        <h2 className="mb-4 text-xl font-semibold">Equipo</h2>
        {failure ? (
          <p role="alert" className="alert-error mb-3">
            {failure.message}
          </p>
        ) : null}
        {team.isLoading ? <p role="status">Cargando el equipo…</p> : null}
        <ul className="divide-y divide-line">
          {(team.data ?? []).map(member => {
            const name = member.name || member.email;
            const agent = member.agent;
            const label = agent ? "Quitar de soporte" : "Hacer agente";
            const availability = agent?.availability;

            return (
              <li
                key={member.user_id}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <div className="grow">
                  <p className="font-medium">{name}</p>
                  <p className="text-sm text-muted">{member.email}</p>
                </div>
                <span className="badge badge-neutral">
                  {roleLabels[member.role] ?? member.role}
                </span>
                {agent ? (
                  <span className="badge">
                    Agente · {ticketAvailabilityLabels[agent.availability]}
                  </span>
                ) : (
                  <span className="badge badge-neutral">Solicitante</span>
                )}
                {availability ? (
                  <span className="text-xs text-muted">
                    {agent?.workday_start.slice(0, 5)}–
                    {agent?.workday_end.slice(0, 5)} · {agent?.timezone}
                  </span>
                ) : null}
                {isOwner ? (
                  <button
                    className="button-ghost"
                    disabled={setAgent.isPending}
                    onClick={() => {
                      const enabled = !agent;
                      const body = { accountId, userId: member.user_id };

                      return setAgent.mutate({ ...body, enabled });
                    }}
                  >
                    {label}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};
