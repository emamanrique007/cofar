import { vTicket } from "@/validations/tickets.validations";

export const ticketFormSchema = vTicket.form();
export const ticketFormDefaults = {
  title: "",
  description: "",
  categoryId: ""
};
