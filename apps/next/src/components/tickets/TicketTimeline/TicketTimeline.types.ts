import type { TicketEventItem } from "@/types/ticket.types";

export interface TicketTimelineProps {
  events: TicketEventItem[];
  assigneeName: string;
}
