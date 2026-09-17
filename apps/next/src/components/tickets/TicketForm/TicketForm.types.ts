import type { z } from "zod";

import { ticketFormSchema } from "./TicketForm.helpers";

export interface TicketFormProps {
  accountId: string;
}

export interface TicketFormResult {
  categoryName: string;
  number: number;
}

export type TicketFormInput = z.input<typeof ticketFormSchema>;
export type TicketFormOutput = z.output<typeof ticketFormSchema>;
