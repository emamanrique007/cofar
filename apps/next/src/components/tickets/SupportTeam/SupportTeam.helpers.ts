import { vAgent } from "@/validations/agents.validations";

export const inviteSchema = vAgent.inviteForm();
export const inviteDefaults = { email: "", asAgent: true };

export const roleLabels: Record<string, string> = {
  owner: "Administrador",
  member: "Integrante"
};
