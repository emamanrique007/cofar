"use client";

import { ticketPriorityLabels, ticketStatusLabels } from "@cofar/utils";
import Link from "next/link";

import type { TicketListProps } from "./TicketList.types";
import { formatRelative } from "@/utils/format.utils";
import { firstResponseState, resolutionState } from "@/utils/ticket.view.utils";
import { priorityBadgeClass, slaBadgeClass } from "@/utils/ticket.view.utils";
import { statusBadgeClass } from "@/utils/ticket.view.utils";

export const TicketList = (props: TicketListProps) => {
  const { tickets, emptyMessage, showRequester, onClaim, claimingId } = props;
  const now = Date.now();

  if (!tickets.length) {
    return <p className="text-muted">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {tickets.map(ticket => {
        const { first_response_due_at, resolution_due_at } = ticket;
        const pending = !ticket.first_responded_at;
        const due = pending ? first_response_due_at : resolution_due_at;
        const response = firstResponseState(ticket, now);
        const resolution = resolutionState(ticket, now);
        const state = pending ? response : resolution;
        const label = pending ? "1ª respuesta" : "Resolución";
        const category = ticket.category?.name ?? "Sin clasificar";
        const who = ticket.requester?.name || ticket.requester?.email || "";
        const agent = ticket.assignee?.name || ticket.assignee?.email || "";
        const owner = agent ? `Atiende ${agent}` : "Sin asignar";
        const from = showRequester ? `${who} · ` : "";

        return (
          <li key={ticket.id} className="flex flex-wrap gap-3 py-4">
            <div className="min-w-64 grow">
              <Link
                href={`/tickets/${ticket.id}`}
                className="font-medium underline-offset-2 hover:underline"
              >
                #{ticket.number} · {ticket.title}
              </Link>
              <p className="mt-1 text-sm text-muted">
                {category} · {from}
                {owner}
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <span className={statusBadgeClass(ticket.status)}>
                {ticketStatusLabels[ticket.status]}
              </span>
              <span className={priorityBadgeClass(ticket.priority)}>
                {ticketPriorityLabels[ticket.priority]}
              </span>
              <span className={slaBadgeClass(state)}>
                {label} {formatRelative(due, now)}
              </span>
              {onClaim && ticket.status === "new" ? (
                <button
                  className="button-ghost"
                  disabled={claimingId === ticket.id}
                  onClick={() => {
                    return onClaim(ticket.id);
                  }}
                >
                  Tomar
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
