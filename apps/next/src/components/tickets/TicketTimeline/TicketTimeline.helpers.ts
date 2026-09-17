import type { Database } from "@cofar/types";
import { ticketEventLabels, ticketPriorityLabels } from "@cofar/utils";
import { ticketStatusLabels } from "@cofar/utils";

import type { TicketEventItem } from "@/types/ticket.types";

const statusLabel = (value: string | null) => {
  const key = value as Database["public"]["Enums"]["ticket_status"];

  return ticketStatusLabels[key] ?? value ?? "—";
};

const priorityLabel = (value: string | null) => {
  const key = value as Database["public"]["Enums"]["ticket_priority"];

  return ticketPriorityLabels[key] ?? value ?? "—";
};

const readDetail = (detail: unknown) => {
  if (!detail || typeof detail !== "object") {
    return {};
  }

  return detail as Record<string, unknown>;
};

const readTerms = (detail: unknown) => {
  const evidence = readDetail(readDetail(detail).evidence);
  const terms = evidence.terms;

  return Array.isArray(terms) ? terms.map(String) : [];
};

const targetLabels: Record<string, string> = {
  first_response: "primera respuesta",
  resolution: "resolución"
};

export const describeEvent = (event: TicketEventItem, assignee: string) => {
  if (event.type === "status_changed") {
    const from = statusLabel(event.from_value);

    return `${from} → ${statusLabel(event.to_value)}`;
  }

  if (event.type === "priority_changed") {
    const from = priorityLabel(event.from_value);

    return `${from} → ${priorityLabel(event.to_value)}`;
  }

  if (event.type === "assigned") {
    const auto = readDetail(event.detail).mode === "auto";
    const how = auto ? "por asignación automática" : "al tomarlo";

    return `${assignee || "Un agente"} ${how}`;
  }

  if (event.type === "classified") {
    const detail = readDetail(event.detail);
    const evidence = readDetail(detail.evidence);
    const raw = Number(detail.confidence ?? evidence.confidence ?? 0);
    const share = Math.round(raw * 100);
    const terms = readTerms(event.detail).join(", ");
    const reason = `${share}% de la evidencia: ${terms}`;

    if (detail.agrees === false) {
      return `Las reglas sugerían ${event.to_value} (${reason})`;
    }

    return `${event.to_value} · ${reason}`;
  }

  if (event.type === "recategorized") {
    return `${event.from_value ?? "sin categoría"} → ${event.to_value}`;
  }

  if (event.type === "sla_breached") {
    const target = targetLabels[event.to_value ?? ""] ?? event.to_value;

    return `Se venció la ${target}`;
  }

  return ticketEventLabels[event.type];
};
