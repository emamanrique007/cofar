import type { QueueFilters } from "@/components/tickets/TicketFilters/TicketFilters.types";

export const buildListInput = (accountId: string, filters: QueueFilters) => {
  const status = filters.status ? [filters.status] : [];
  const priority = filters.priority ? [filters.priority] : [];
  const categoryId = filters.categoryId || null;
  const p1 = { accountId, status, priority, categoryId };
  const p2 = { assignment: filters.assignment, overdue: filters.overdue };
  const p3 = { search: filters.search, order: filters.order };

  return { ...p1, ...p2, ...p3 };
};
