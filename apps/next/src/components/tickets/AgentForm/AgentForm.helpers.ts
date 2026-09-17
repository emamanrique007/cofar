import { getPublicEnv } from "@/config/env.config";
import { vAgent } from "@/validations/agents.validations";

export const agentFormSchema = vAgent.createForm();

export const agentFormDefaults = {
  name: "",
  email: "",
  password: "",
  asAgent: true,
  timezone: getPublicEnv().NEXT_PUBLIC_TIMEZONE ?? "UTC",
  days: ["1", "2", "3", "4", "5"],
  start: "09:00",
  end: "18:00",
  maxOpen: 5,
  autoAssign: true,
  categoryIds: []
};
