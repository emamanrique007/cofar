import { Constants } from "@cofar/types";
import { z } from "zod";

const statuses = Constants.public.Enums.ticket_status;
const priorities = Constants.public.Enums.ticket_priority;

const accountValidation = () => {
  return z.object({ accountId: z.uuid() });
};

const ticketValidation = () => {
  return z.object({ ticketId: z.uuid() });
};

const formValidation = () => {
  return z.object({
    title: z
      .string()
      .trim()
      .min(5, "Escribí un título más descriptivo")
      .max(120),
    description: z
      .string()
      .trim()
      .min(10, "Contanos qué pasó con más detalle")
      .max(4000),
    categoryId: z.uuid("Elegí una categoría")
  });
};

const createValidation = () => {
  return z.object({
    accountId: z.uuid(),
    title: z.string().trim().min(5).max(120),
    description: z.string().trim().min(10).max(4000),
    categoryId: z.uuid()
  });
};

const filtersValidation = () => {
  return z.object({
    accountId: z.uuid(),
    scope: z.enum(["all", "requester"]).default("all"),
    assignment: z.enum(["any", "mine", "unassigned"]).default("any"),
    status: z.array(z.enum(statuses)).max(statuses.length).default([]),
    priority: z.array(z.enum(priorities)).max(priorities.length).default([]),
    categoryId: z.uuid().nullable().default(null),
    overdue: z.boolean().default(false),
    search: z.string().trim().max(120).default(""),
    order: z.enum(["newest", "due"]).default("newest")
  });
};

const statusValidation = () => {
  return z.object({ ticketId: z.uuid(), status: z.enum(statuses) });
};

const priorityValidation = () => {
  return z.object({ ticketId: z.uuid(), priority: z.enum(priorities) });
};

const categoryValidation = () => {
  return z.object({ ticketId: z.uuid(), categoryId: z.uuid() });
};

const createdValidation = () => {
  return z.object({
    ticket_id: z.uuid(),
    number: z.number().int(),
    category_id: z.uuid().nullable(),
    category: z.string().nullable(),
    priority: z.enum(priorities)
  });
};

const counter = z.record(z.string(), z.number());

const metricsValidation = () => {
  return z.object({
    total: z.number(),
    open: z.number(),
    unassigned: z.number(),
    mine: z.number(),
    overdue_first_response: z.number(),
    overdue_resolution: z.number(),
    first_response_total: z.number(),
    first_response_on_time: z.number(),
    resolution_total: z.number(),
    resolution_on_time: z.number(),
    avg_resolution_hours: z.coerce.number(),
    auto_categorized: z.number(),
    agent_corrected: z.number(),
    agents: z.number(),
    by_status: counter,
    by_priority: counter,
    by_category: counter
  });
};

export const vTicket = {
  created: createdValidation,
  metrics: metricsValidation,
  account: accountValidation,
  ticket: ticketValidation,
  form: formValidation,
  create: createValidation,
  filters: filtersValidation,
  status: statusValidation,
  priority: priorityValidation,
  category: categoryValidation
};
