import "server-only";
import type { TicketWorkerClient } from "@/types/ticket.types";
import { createAdminClient } from "@/utils/supabase/supabase.admin";

export const createTicketWorkerClient = (): TicketWorkerClient => {
  const db = createAdminClient();

  return {
    pending: async batch => {
      const { data, error } = await db.rpc("pending_ticket_assignments", {
        batch
      });

      if (error) {
        throw error;
      }

      return data;
    },
    assign: async ticketId => {
      const params = { ticket: ticketId };
      const { data, error } = await db.rpc("auto_assign_ticket", params);

      if (error) {
        throw error;
      }

      return data;
    },
    sweep: async batch => {
      const { data, error } = await db.rpc("sweep_ticket_sla", { batch });

      if (error) {
        throw error;
      }

      const empty = { first_response: 0, resolution: 0 };

      return data[0] ?? empty;
    }
  };
};
