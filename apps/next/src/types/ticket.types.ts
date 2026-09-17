import type { Database, TicketClassification } from "@cofar/types";
import type { z } from "zod";

import { vTicket } from "@/validations/tickets.validations";

type TicketRow = Database["public"]["Tables"]["tickets"]["Row"];
type TicketEventRow = Database["public"]["Tables"]["ticket_events"]["Row"];
type CategoryRow = Database["public"]["Tables"]["ticket_categories"]["Row"];
type PolicyRow = Database["public"]["Tables"]["sla_policies"]["Row"];
type AgentRow = Database["public"]["Tables"]["ticket_agents"]["Row"];

export interface PendingTicket {
  id: string;
  account_id: string;
  category_id: string | null;
}

export interface SlaSweep {
  first_response: number;
  resolution: number;
}

export interface TicketWorkerClient {
  pending: (batch: number) => Promise<PendingTicket[]>;
  assign: (ticketId: string) => Promise<string | null>;
  sweep: (batch: number) => Promise<SlaSweep>;
}

export interface TicketRunResult {
  pending: number;
  assigned: number;
  unroutable: number;
  breached_first_response: number;
  breached_resolution: number;
}

export interface TicketPerson {
  id: string;
  name: string;
  email: string;
}

export interface TicketCategoryRef {
  id: string;
  name: string;
  slug: string;
}

// Shapes of the composed PostgREST selects. supabase-js cannot infer a select
// string built at runtime, so the router declares the row shape with returns<T>.
export interface TicketListItem extends Pick<
  TicketRow,
  | "id"
  | "number"
  | "title"
  | "status"
  | "priority"
  | "created_at"
  | "category_id"
  | "category_source"
  | "requester_id"
  | "assignee_id"
  | "first_response_due_at"
  | "resolution_due_at"
  | "first_responded_at"
  | "resolved_at"
  | "first_response_breached_at"
  | "resolution_breached_at"
> {
  category: TicketCategoryRef | null;
  requester: TicketPerson | null;
  assignee: TicketPerson | null;
}

export interface TicketDetailItem
  extends
    TicketListItem,
    Pick<
      TicketRow,
      "description" | "category_confidence" | "closed_at" | "account_id"
    > {}

export interface TicketEventItem extends Pick<
  TicketEventRow,
  "id" | "type" | "from_value" | "to_value" | "created_at"
> {
  detail?: unknown;
  actor: TicketPerson | null;
}

export interface AgentShiftRow extends Pick<
  AgentRow,
  | "user_id"
  | "availability"
  | "timezone"
  | "max_open_tickets"
  | "auto_assign"
  | "working_days"
  | "workday_start"
  | "workday_end"
  | "last_assigned_at"
> {}

export interface TeamMember {
  user_id: string;
  role: string;
  name: string;
  email: string;
  agent: AgentShiftRow | null;
}

export interface TicketCreated {
  ticket: z.output<ReturnType<typeof vTicket.created>>;
  suggestion: TicketClassification;
}

export type TicketCategoryItem = Pick<
  CategoryRow,
  "id" | "name" | "slug" | "default_priority" | "is_fallback"
>;
export type TicketPolicyItem = Pick<
  PolicyRow,
  "priority" | "first_response_minutes" | "resolution_minutes"
>;
export type TicketMetricsData = z.output<ReturnType<typeof vTicket.metrics>>;
export type AgentShift = AgentShiftRow | null;
