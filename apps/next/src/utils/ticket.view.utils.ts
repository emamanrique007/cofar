import type { Database, SlaState } from "@cofar/types";
import { getSlaState } from "@cofar/utils";

const slaClasses: Record<SlaState, string> = {
  met: "badge badge-ok",
  on_track: "badge badge-neutral",
  due_soon: "badge badge-warn",
  breached: "badge badge-danger",
  unknown: "badge badge-neutral"
};

const statusClasses: Record<
  Database["public"]["Enums"]["ticket_status"],
  string
> = {
  new: "badge badge-warn",
  assigned: "badge",
  in_progress: "badge",
  resolved: "badge badge-ok",
  closed: "badge badge-neutral"
};

const priorityClasses: Record<
  Database["public"]["Enums"]["ticket_priority"],
  string
> = {
  low: "badge badge-neutral",
  normal: "badge badge-neutral",
  high: "badge badge-warn",
  urgent: "badge badge-danger"
};

export const slaBadgeClass = (state: SlaState) => {
  return slaClasses[state];
};

export const statusBadgeClass = (
  status: Database["public"]["Enums"]["ticket_status"]
) => {
  return statusClasses[status];
};

export const priorityBadgeClass = (
  priority: Database["public"]["Enums"]["ticket_priority"]
) => {
  return priorityClasses[priority];
};

// The first response clock stops when an agent answers; the resolution clock
// stops when the ticket is resolved. Both are read from the ticket row itself.
export const firstResponseState = (
  ticket: {
    created_at: string;
    first_response_due_at: string;
    first_responded_at: string | null;
  },
  now: number
) => {
  const startAt = ticket.created_at;
  const dueAt = ticket.first_response_due_at;

  return getSlaState({
    startAt,
    dueAt,
    doneAt: ticket.first_responded_at,
    now
  });
};

export const resolutionState = (
  ticket: {
    created_at: string;
    resolution_due_at: string;
    resolved_at: string | null;
  },
  now: number
) => {
  const startAt = ticket.created_at;
  const dueAt = ticket.resolution_due_at;

  return getSlaState({ startAt, dueAt, doneAt: ticket.resolved_at, now });
};

const agentTransitions: Record<
  Database["public"]["Enums"]["ticket_status"],
  Database["public"]["Enums"]["ticket_status"][]
> = {
  new: [],
  assigned: ["in_progress", "resolved"],
  in_progress: ["resolved"],
  resolved: ["closed", "in_progress"],
  closed: []
};

const requesterTransitions: Database["public"]["Enums"]["ticket_status"][] = [
  "closed",
  "in_progress"
];

// Mirrors set_ticket_status in SQL: the database enforces it, the UI only
// offers the moves that will be accepted.
export const nextStatuses = (
  status: Database["public"]["Enums"]["ticket_status"],
  isAgent: boolean,
  isRequester: boolean
) => {
  if (isAgent) {
    return agentTransitions[status];
  }

  if (isRequester && status === "resolved") {
    return requesterTransitions;
  }

  return [];
};

const actionLabels: Record<
  Database["public"]["Enums"]["ticket_status"],
  string
> = {
  new: "Devolver a la cola",
  assigned: "Asignar",
  in_progress: "Empezar a trabajar",
  resolved: "Marcar resuelto",
  closed: "Cerrar"
};

export const statusActionLabel = (
  from: Database["public"]["Enums"]["ticket_status"],
  to: Database["public"]["Enums"]["ticket_status"]
) => {
  if (from === "resolved" && to === "in_progress") {
    return "Reabrir";
  }

  return actionLabels[to];
};
