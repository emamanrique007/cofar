import type { TicketRunResult, TicketWorkerClient } from "@/types/ticket.types";

export const ASSIGNMENT_BATCH = 25;
export const SWEEP_BATCH = 200;

// One route is one (account, category) pair. When nobody can take the first
// ticket of a route, the rest of that route is skipped instead of asking again.
export const processTicketQueue = async (
  client: TicketWorkerClient,
  batch: number = ASSIGNMENT_BATCH
): Promise<TicketRunResult> => {
  const pending = await client.pending(batch);
  const blocked = new Set<string>();
  let assigned = 0;
  let unroutable = 0;

  for (const ticket of pending) {
    const route = `${ticket.account_id}:${ticket.category_id ?? ""}`;

    if (blocked.has(route)) {
      unroutable = unroutable + 1;
      continue;
    }

    const agent = await client.assign(ticket.id);

    if (agent) {
      assigned = assigned + 1;
      continue;
    }

    blocked.add(route);
    unroutable = unroutable + 1;
  }

  const sweep = await client.sweep(SWEEP_BATCH);
  const routed = { pending: pending.length, assigned, unroutable };
  const breached_first_response = sweep.first_response;
  const breached_resolution = sweep.resolution;

  return { ...routed, breached_first_response, breached_resolution };
};
