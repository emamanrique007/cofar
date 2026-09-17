import type { AgentShift } from "@/types/ticket.types";
import { vAgent } from "@/validations/agents.validations";

export const shiftSchema = vAgent.shiftForm();

export const shiftDefaults = {
  availability: "available" as const,
  timezone: "UTC",
  days: ["1", "2", "3", "4", "5"],
  start: "09:00",
  end: "18:00",
  maxOpen: 5,
  autoAssign: true
};

export const toShiftValues = (agent: NonNullable<AgentShift>) => {
  const p1 = { availability: agent.availability, timezone: agent.timezone };
  const days = agent.working_days.map(String);
  const p2 = { days, start: agent.workday_start.slice(0, 5) };
  const p3 = {
    end: agent.workday_end.slice(0, 5),
    maxOpen: agent.max_open_tickets
  };

  return { ...p1, ...p2, ...p3, autoAssign: agent.auto_assign };
};
