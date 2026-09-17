import type { Database } from "@cofar/types";

export const jobStatusLabels: Record<
  Database["public"]["Enums"]["job_status"],
  string
> = {
  queued: "En cola",
  completed: "Completado",
  failed: "Fallido"
};
