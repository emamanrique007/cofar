import type { Database } from "@cofar/types";

export { classifyTicket, getSlaState, normalizeText } from "./tickets.js";
export { DUE_SOON_SHARE } from "./tickets.js";
export { MIN_CLASSIFICATION_CONFIDENCE } from "./tickets.js";
export { MIN_CLASSIFICATION_SCORE } from "./tickets.js";
export { slaStateLabels, ticketAvailabilityLabels } from "./ticket.labels.js";
export { ticketEventLabels, ticketPriorityLabels } from "./ticket.labels.js";
export { ticketSourceLabels, ticketStatusLabels } from "./ticket.labels.js";
export { weekdayLabels } from "./ticket.labels.js";

export const jobStatusLabels: Record<
  Database["public"]["Enums"]["job_status"],
  string
> = {
  queued: "En cola",
  completed: "Completado",
  failed: "Fallido"
};
