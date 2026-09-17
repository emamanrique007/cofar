import type { QueueClient } from "@/types/queue.types";
import { jobMessage } from "@/validations/jobs.validations";

export const processJobs = async (client: QueueClient) => {
  const messages = await client.read();
  const result = { read: messages.length, completed: 0, failed: 0, stale: 0 };

  for (const item of messages) {
    try {
      jobMessage.parse(item.message);

      if (await client.complete(item.msg_id, item.read_ct)) {
        result.completed++;
      } else {
        result.stale++;
      }
    } catch {
      // Keep service/database internals out of tenant-visible last_error.
      if (
        await client.fail(
          item.msg_id,
          item.read_ct,
          "No se pudo procesar el trabajo"
        )
      ) {
        result.failed++;
      } else {
        result.stale++;
      }
    }
  }

  return result;
};
