import type { z } from "zod";

import { agentFormSchema } from "./AgentForm.helpers";

export interface AgentFormProps {
  accountId: string;
}

export type AgentFormInput = z.input<typeof agentFormSchema>;
export type AgentFormOutput = z.output<typeof agentFormSchema>;
