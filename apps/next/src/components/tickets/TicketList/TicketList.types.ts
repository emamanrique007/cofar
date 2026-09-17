import type { TicketListItem } from "@/types/ticket.types";

export interface TicketListProps {
  tickets: TicketListItem[];
  emptyMessage: string;
  showRequester?: boolean;
  onClaim?: (ticketId: string) => void;
  claimingId?: string;
}
