"use client";

import { Constants } from "@cofar/types";
import type { Database } from "@cofar/types";
import { slaStateLabels, ticketPriorityLabels } from "@cofar/utils";
import { ticketSourceLabels, ticketStatusLabels } from "@cofar/utils";

import type { TicketDetailProps } from "./TicketDetail.types";
import { TicketTimeline } from "@/components/tickets/TicketTimeline/TicketTimeline";
import { trpc } from "@/config/trpc.config";
import { formatDateTime, formatRelative } from "@/utils/format.utils";
import { firstResponseState, resolutionState } from "@/utils/ticket.view.utils";
import { nextStatuses, statusActionLabel } from "@/utils/ticket.view.utils";
import { priorityBadgeClass, slaBadgeClass } from "@/utils/ticket.view.utils";
import { statusBadgeClass } from "@/utils/ticket.view.utils";

export const TicketDetail = (props: TicketDetailProps) => {
  const { ticketId, userId, isAgent } = props;
  const utils = trpc.useUtils();
  const options = { refetchInterval: 15000 };
  const detail = trpc.tickets.detail.useQuery({ ticketId }, options);
  const ticket = detail.data?.ticket;
  const accountId = ticket?.account_id ?? "";
  const categoryOptions = { enabled: isAgent && !!accountId };
  const categories = trpc.tickets.categories.useQuery(
    { accountId },
    categoryOptions
  );

  const onDone = async () => {
    await utils.tickets.detail.invalidate({ ticketId });
    await utils.tickets.list.invalidate();
  };

  const claim = trpc.tickets.claim.useMutation({ onSuccess: onDone });
  const status = trpc.tickets.setStatus.useMutation({ onSuccess: onDone });
  const priority = trpc.tickets.setPriority.useMutation({ onSuccess: onDone });
  const category = trpc.tickets.setCategory.useMutation({ onSuccess: onDone });

  if (detail.isLoading) {
    return <p role="status">Cargando el ticket…</p>;
  }

  if (detail.error || !ticket) {
    return (
      <p role="alert" className="alert-error">
        {detail.error?.message ?? "El ticket no existe"}
      </p>
    );
  }

  const now = Date.now();
  const response = firstResponseState(ticket, now);
  const resolution = resolutionState(ticket, now);
  const isRequester = ticket.requester_id === userId;
  const moves = nextStatuses(ticket.status, isAgent, isRequester);
  const requester = ticket.requester?.name || ticket.requester?.email || "—";
  const assignee = ticket.assignee?.name || ticket.assignee?.email || "";
  const source = ticket.category_source;
  const confidence = ticket.category_confidence;
  const share = confidence === null ? "" : `${Math.round(confidence * 100)}%`;
  const busy = status.isPending || priority.isPending || category.isPending;
  const failure =
    claim.error ?? status.error ?? priority.error ?? category.error;

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Ticket #{ticket.number}</p>
            <h1 className="text-2xl font-semibold">{ticket.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={statusBadgeClass(ticket.status)}>
              {ticketStatusLabels[ticket.status]}
            </span>
            <span className={priorityBadgeClass(ticket.priority)}>
              {ticketPriorityLabels[ticket.priority]}
            </span>
          </div>
        </div>
        <p className="mt-4 whitespace-pre-line">{ticket.description}</p>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Solicitante</dt>
            <dd>{requester}</dd>
          </div>
          <div>
            <dt className="text-muted">Agente</dt>
            <dd>{assignee || "Sin asignar"}</dd>
          </div>
          <div>
            <dt className="text-muted">Categoría</dt>
            <dd>
              {ticket.category?.name ?? "Sin clasificar"}
              {source ? ` · ${ticketSourceLabels[source]}` : ""}
              {share ? ` · ${share}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Creado</dt>
            <dd>{formatDateTime(ticket.created_at)}</dd>
          </div>
        </dl>
      </section>
      <section className="card">
        <h2 className="mb-4 text-xl font-semibold">Acuerdo de servicio</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted">Primera respuesta</p>
            <p className={slaBadgeClass(response)}>
              {slaStateLabels[response]}
            </p>
            <p className="mt-2 text-sm">
              Vence {formatRelative(ticket.first_response_due_at, now)} (
              {formatDateTime(ticket.first_response_due_at)})
            </p>
            <p className="text-sm text-muted">
              Respondido: {formatDateTime(ticket.first_responded_at)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted">Resolución</p>
            <p className={slaBadgeClass(resolution)}>
              {slaStateLabels[resolution]}
            </p>
            <p className="mt-2 text-sm">
              Vence {formatRelative(ticket.resolution_due_at, now)} (
              {formatDateTime(ticket.resolution_due_at)})
            </p>
            <p className="text-sm text-muted">
              Resuelto: {formatDateTime(ticket.resolved_at)}
            </p>
          </div>
        </div>
      </section>
      <section className="card">
        <h2 className="mb-4 text-xl font-semibold">Acciones</h2>
        {failure ? (
          <p role="alert" className="alert-error mb-3">
            {failure.message}
          </p>
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          {isAgent && ticket.status === "new" ? (
            <button
              disabled={claim.isPending}
              onClick={() => {
                return claim.mutate({ ticketId });
              }}
            >
              Tomar este ticket
            </button>
          ) : null}
          {moves.map(move => {
            return (
              <button
                key={move}
                className="button-ghost"
                disabled={busy}
                onClick={() => {
                  return status.mutate({ ticketId, status: move });
                }}
              >
                {statusActionLabel(ticket.status, move)}
              </button>
            );
          })}
          {isAgent ? (
            <label className="text-sm">
              Prioridad
              <select
                className="mt-1"
                disabled={busy}
                value={ticket.priority}
                onChange={event => {
                  const value = event.target.value;
                  const next =
                    value as Database["public"]["Enums"]["ticket_priority"];

                  return priority.mutate({ ticketId, priority: next });
                }}
              >
                {Constants.public.Enums.ticket_priority.map(value => {
                  return (
                    <option key={value} value={value}>
                      {ticketPriorityLabels[value]}
                    </option>
                  );
                })}
              </select>
            </label>
          ) : null}
          {isAgent ? (
            <label className="text-sm">
              Corregir categoría
              <select
                className="mt-1"
                disabled={busy}
                value={ticket.category_id ?? ""}
                onChange={event => {
                  const categoryId = event.target.value;

                  return category.mutate({ ticketId, categoryId });
                }}
              >
                {(categories.data ?? []).map(item => {
                  return (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  );
                })}
              </select>
            </label>
          ) : null}
        </div>
        {moves.length === 0 && !isAgent ? (
          <p className="text-sm text-muted">
            Tu solicitud está en manos del equipo de soporte.
          </p>
        ) : null}
      </section>
      <section className="card">
        <h2 className="mb-4 text-xl font-semibold">Trazabilidad</h2>
        <TicketTimeline
          events={detail.data?.events ?? []}
          assigneeName={assignee}
        />
      </section>
    </div>
  );
};
