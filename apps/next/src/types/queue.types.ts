import type { QueueMessage } from "@cofar/types";

export interface QueueClient {
  read: () => Promise<QueueMessage[]>;
  complete: (id: number, receipt: number) => Promise<boolean>;
  fail: (id: number, receipt: number, reason: string) => Promise<boolean>;
}
