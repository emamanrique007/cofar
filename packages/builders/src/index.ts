import type { JobMessage } from "@cofar/types";

export const buildJobMessage = (jobId: string): JobMessage => {
  return {
    job_id: jobId
  };
};
