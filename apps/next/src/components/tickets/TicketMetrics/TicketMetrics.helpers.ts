import type { Database } from "@cofar/types";
import { ticketPriorityLabels, ticketStatusLabels } from "@cofar/utils";

import type { MetricCard } from "./TicketMetrics.types";
import type { TicketMetricsData } from "@/types/ticket.types";
import { formatPercent } from "@/utils/format.utils";

export const buildCards = (data: TicketMetricsData): MetricCard[] => {
  const open = { label: "Abiertos", value: String(data.open) };
  const unassigned = { label: "Sin asignar", value: String(data.unassigned) };
  const mine = { label: "Asignados a mí", value: String(data.mine) };
  const late = data.overdue_first_response + data.overdue_resolution;
  const overdue = { label: "Vencidos", value: String(late) };
  const hours = {
    label: "Resolución promedio",
    value: `${data.avg_resolution_hours} h`
  };

  return [
    { ...open, hint: `${data.total} tickets en total` },
    { ...unassigned, hint: `${data.agents} agentes en el equipo` },
    { ...mine, hint: "Tu carga actual" },
    {
      ...overdue,
      hint: `${data.overdue_first_response} sin primera respuesta`
    },
    { ...hours, hint: `${data.resolution_total} tickets resueltos` }
  ];
};

export const buildCompliance = (data: TicketMetricsData) => {
  const first = formatPercent(
    data.first_response_on_time,
    data.first_response_total
  );
  const resolved = formatPercent(
    data.resolution_on_time,
    data.resolution_total
  );
  const corrected = formatPercent(data.agent_corrected, data.auto_categorized);

  return { first, resolved, corrected };
};

export const statusLabel = (key: string) => {
  const status = key as Database["public"]["Enums"]["ticket_status"];

  return ticketStatusLabels[status] ?? key;
};

export const priorityLabel = (key: string) => {
  const priority = key as Database["public"]["Enums"]["ticket_priority"];

  return ticketPriorityLabels[priority] ?? key;
};
