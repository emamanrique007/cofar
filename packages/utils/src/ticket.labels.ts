import type { Database } from "@cofar/types";
import type { SlaState } from "@cofar/types";

export const ticketStatusLabels: Record<
  Database["public"]["Enums"]["ticket_status"],
  string
> = {
  new: "En cola",
  assigned: "Asignado",
  in_progress: "En curso",
  resolved: "Resuelto",
  closed: "Cerrado"
};

export const ticketPriorityLabels: Record<
  Database["public"]["Enums"]["ticket_priority"],
  string
> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente"
};

export const ticketEventLabels: Record<
  Database["public"]["Enums"]["ticket_event_type"],
  string
> = {
  created: "Solicitud creada",
  classified: "Sugerencia de las reglas",
  assigned: "Asignación",
  status_changed: "Cambio de estado",
  priority_changed: "Cambio de prioridad",
  recategorized: "Categoría corregida",
  sla_breached: "SLA vencido"
};

export const ticketSourceLabels: Record<
  Database["public"]["Enums"]["ticket_category_source"],
  string
> = {
  requester: "Elegida por quien pidió",
  auto: "Asignada por reglas",
  agent: "Corregida por un agente"
};

export const ticketAvailabilityLabels: Record<
  Database["public"]["Enums"]["ticket_availability"],
  string
> = {
  available: "Disponible",
  busy: "Ocupado",
  offline: "Fuera de turno"
};

export const slaStateLabels: Record<SlaState, string> = {
  met: "Cumplido",
  on_track: "En plazo",
  due_soon: "Por vencer",
  breached: "Vencido",
  unknown: "Sin plazo"
};

export const weekdayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
