import "server-only";
import type { QueueClient } from "@/types/queue.types";
import { createAdminClient } from "@/utils/supabase/supabase.admin";

export const createQueueClient = (): QueueClient => {
  const db = createAdminClient();

  return {
    read: async () => {
      const { data, error } = await db.rpc("read_jobs", { batch_size: 10 });

      if (error) {
        throw error;
      }

      return data;
    },
    complete: async (message_id, receipt) => {
      const params = { message_id, receipt };
      const { data, error } = await db.rpc("complete_job", params);

      if (error) {
        throw error;
      }

      return data;
    },
    fail: async (message_id, receipt, reason) => {
      const params = { message_id, receipt, reason };
      const { data, error } = await db.rpc("fail_job", params);

      if (error) {
        throw error;
      }

      return data;
    }
  };
};
