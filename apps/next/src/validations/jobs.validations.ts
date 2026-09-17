import { z } from "zod";

export const accountInput = z.object({ accountId: z.uuid() });
export const jobInput = accountInput.extend({
  requestId: z.uuid(),
  message: z.string().trim().min(1).max(1000)
});
export const jobMessage = z.object({ job_id: z.uuid() });

export const vJob = {
  enqueueForm: () => {
    return z.object({
      message: z.string().trim().min(1, "Escribí un mensaje").max(1000)
    });
  }
};
