import type { z } from "zod";

import { shiftSchema } from "./AgentShift.helpers";

export interface AgentShiftProps {
  accountId: string;
}

export type ShiftInput = z.input<typeof shiftSchema>;
export type ShiftOutput = z.output<typeof shiftSchema>;
