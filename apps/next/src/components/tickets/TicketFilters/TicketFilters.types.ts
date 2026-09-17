import type { Database } from "@cofar/types";

import type { TicketCategoryItem } from "@/types/ticket.types";

export interface QueueFilters {
  status: "" | Database["public"]["Enums"]["ticket_status"];
  priority: "" | Database["public"]["Enums"]["ticket_priority"];
  categoryId: string;
  assignment: "any" | "mine" | "unassigned";
  overdue: boolean;
  search: string;
  order: "newest" | "due";
}

export interface TicketFiltersProps {
  value: QueueFilters;
  categories: TicketCategoryItem[];
  onChange: (next: QueueFilters) => void;
}
