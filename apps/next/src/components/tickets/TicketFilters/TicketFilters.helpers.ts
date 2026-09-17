import { Constants } from "@cofar/types";
import { ticketPriorityLabels, ticketStatusLabels } from "@cofar/utils";

import type { QueueFilters } from "./TicketFilters.types";

export const emptyFilters: QueueFilters = {
  status: "",
  priority: "",
  categoryId: "",
  assignment: "any",
  overdue: false,
  search: "",
  order: "due"
};

export const statusOptions = Constants.public.Enums.ticket_status.map(value => {
  return { value, label: ticketStatusLabels[value] };
});

export const priorityOptions = Constants.public.Enums.ticket_priority.map(
  value => {
    return { value, label: ticketPriorityLabels[value] };
  }
);

export const assignmentOptions = [
  { value: "any", label: "Todos" },
  { value: "mine", label: "Asignados a mí" },
  { value: "unassigned", label: "Sin asignar" }
];

export const orderOptions = [
  { value: "due", label: "Vencimiento más cercano" },
  { value: "newest", label: "Más recientes" }
];
