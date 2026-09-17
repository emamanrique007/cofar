import type { z } from "zod";

import { createAccountSchema, enqueueJobSchema } from "./Dashboard.helpers";

export interface DashboardProps {
  email: string;
}

export type CreateAccountInput = z.input<typeof createAccountSchema>;
export type CreateAccountOutput = z.output<typeof createAccountSchema>;
export type EnqueueJobInput = z.input<typeof enqueueJobSchema>;
export type EnqueueJobOutput = z.output<typeof enqueueJobSchema>;
