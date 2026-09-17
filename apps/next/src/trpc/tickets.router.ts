import { classifyTicket } from "@cofar/utils";
import { TRPCError } from "@trpc/server";

import { router, userProcedure } from "./trpc";
import type { TicketDetailItem, TicketListItem } from "@/types/ticket.types";
import type { TicketEventItem } from "@/types/ticket.types";
import { toTRPCError } from "@/utils/trpc.utils";
import { vTicket } from "@/validations/tickets.validations";

const ticketColumns = "id, number, title, status, priority, created_at";
const ticketDates =
  "first_response_due_at, resolution_due_at, first_responded_at";
const ticketState =
  "resolved_at, first_response_breached_at, resolution_breached_at";
const ticketRefs = "category_id, requester_id, assignee_id, category_source";
const categoryJoin = "category:ticket_categories(id, name, slug)";
const requesterJoin =
  "requester:profiles!tickets_requester_id_fkey(id, name, email)";
const assigneeJoin =
  "assignee:profiles!tickets_assignee_id_fkey(id, name, email)";
const listBase = [ticketColumns, ticketDates, ticketState, ticketRefs].join(
  ", "
);
const listJoins = [categoryJoin, requesterJoin, assigneeJoin].join(", ");
const listSelect = `${listBase}, ${listJoins}`;
const detailExtra = "description, category_confidence, closed_at, account_id";
const detailSelect = `${listSelect}, ${detailExtra}`;
const eventSelect = "id, type, from_value, to_value, detail, created_at";
const eventJoin = "actor:profiles(id, name, email)";
const LIST_LIMIT = 100;
const descending = { ascending: false };

export const ticketsRouter = router({
  categories: userProcedure
    .input(vTicket.account())
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("ticket_categories")
        .select("id, name, slug, default_priority, is_fallback")
        .eq("account_id", input.accountId)
        .eq("active", true)
        .order("name");

      if (error) {
        throw toTRPCError(error, "No se pudieron cargar las categorías");
      }

      return data;
    }),
  policies: userProcedure
    .input(vTicket.account())
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("sla_policies")
        .select("priority, first_response_minutes, resolution_minutes")
        .eq("account_id", input.accountId);

      if (error) {
        throw toTRPCError(error, "No se pudieron cargar los acuerdos de SLA");
      }

      return data;
    }),
  list: userProcedure.input(vTicket.filters()).query(async ({ ctx, input }) => {
    let query = ctx.supabase
      .from("tickets")
      .select(listSelect)
      .eq("account_id", input.accountId)
      .limit(LIST_LIMIT);

    if (input.scope === "requester") {
      query = query.eq("requester_id", ctx.user.id);
    }

    if (input.assignment === "mine") {
      query = query.eq("assignee_id", ctx.user.id);
    }

    if (input.assignment === "unassigned") {
      query = query.is("assignee_id", null);
    }

    if (input.status.length) {
      query = query.in("status", input.status);
    }

    if (input.priority.length) {
      query = query.in("priority", input.priority);
    }

    if (input.categoryId) {
      query = query.eq("category_id", input.categoryId);
    }

    if (input.overdue) {
      const breached = "first_response_breached_at.not.is.null";

      query = query.or(`${breached},resolution_breached_at.not.is.null`);
    }

    if (input.search) {
      const options = { type: "websearch" as const, config: "spanish" };

      query = query.textSearch("search_text", input.search, options);
    }

    const byDue = input.order === "due";
    const sorted = byDue ? query.order("first_response_due_at") : query;
    const ordered = byDue ? sorted : sorted.order("created_at", descending);
    const { data, error } = await ordered.returns<TicketListItem[]>();

    if (error) {
      throw toTRPCError(error, "No se pudieron cargar los tickets");
    }

    return data;
  }),
  detail: userProcedure
    .input(vTicket.ticket())
    .query(async ({ ctx, input }) => {
      const ticket = await ctx.supabase
        .from("tickets")
        .select(detailSelect)
        .eq("id", input.ticketId)
        .returns<TicketDetailItem[]>()
        .maybeSingle();

      if (ticket.error) {
        throw toTRPCError(ticket.error, "No se pudo cargar el ticket");
      }

      if (!ticket.data) {
        const code = "NOT_FOUND" as const;

        throw new TRPCError({ code, message: "El ticket no existe" });
      }

      const events = await ctx.supabase
        .from("ticket_events")
        .select(`${eventSelect}, ${eventJoin}`)
        .eq("ticket_id", input.ticketId)
        .order("created_at")
        .order("id")
        .returns<TicketEventItem[]>();

      if (events.error) {
        throw toTRPCError(events.error, "No se pudo cargar la trazabilidad");
      }

      return { ticket: ticket.data, events: events.data };
    }),
  create: userProcedure
    .input(vTicket.create())
    .mutation(async ({ ctx, input }) => {
      const rules = await ctx.supabase
        .from("ticket_category_rules")
        .select("category_id, term, weight")
        .eq("account_id", input.accountId);

      if (rules.error) {
        throw toTRPCError(rules.error, "No se pudo clasificar la solicitud");
      }

      const draft = { title: input.title, description: input.description };
      // Quien pide elige la categoría; las reglas corren igual y el ticket
      // guarda el desacuerdo para que un agente lo resuelva.
      const suggestion = classifyTicket(draft, rules.data);
      const terms = suggestion.terms;
      const evidence = { terms, confidence: suggestion.confidence };
      const p1 = { target_account: input.accountId, ticket_title: input.title };
      const p2 = { ticket_description: input.description };
      const p3 = { category: input.categoryId, source: "requester" as const };
      const p4 = { evidence, suggested: suggestion.categoryId ?? undefined };
      const params = { ...p1, ...p2, ...p3, ...p4 };
      const { data, error } = await ctx.supabase.rpc("create_ticket", params);

      if (error) {
        throw toTRPCError(error, "No se pudo crear el ticket");
      }

      return { ticket: vTicket.created().parse(data), suggestion };
    }),
  claim: userProcedure
    .input(vTicket.ticket())
    .mutation(async ({ ctx, input }) => {
      const params = { ticket: input.ticketId };
      const { data, error } = await ctx.supabase.rpc("claim_ticket", params);

      if (error) {
        throw toTRPCError(error, "No se pudo tomar el ticket");
      }

      return { claimed: data };
    }),
  setStatus: userProcedure
    .input(vTicket.status())
    .mutation(async ({ ctx, input }) => {
      const params = { ticket: input.ticketId, next_status: input.status };
      const { data, error } = await ctx.supabase.rpc(
        "set_ticket_status",
        params
      );

      if (error) {
        throw toTRPCError(error, "No se pudo cambiar el estado");
      }

      return { changed: data };
    }),
  setPriority: userProcedure
    .input(vTicket.priority())
    .mutation(async ({ ctx, input }) => {
      const params = { ticket: input.ticketId, next_priority: input.priority };
      const rpc = await ctx.supabase.rpc("set_ticket_priority", params);

      if (rpc.error) {
        throw toTRPCError(rpc.error, "No se pudo cambiar la prioridad");
      }

      return { changed: rpc.data };
    }),
  setCategory: userProcedure
    .input(vTicket.category())
    .mutation(async ({ ctx, input }) => {
      const params = { ticket: input.ticketId, category: input.categoryId };
      const rpc = await ctx.supabase.rpc("set_ticket_category", params);

      if (rpc.error) {
        throw toTRPCError(rpc.error, "No se pudo corregir la categoría");
      }

      return { changed: rpc.data };
    }),
  metrics: userProcedure
    .input(vTicket.account())
    .query(async ({ ctx, input }) => {
      const params = { target_account: input.accountId };
      const { data, error } = await ctx.supabase.rpc("ticket_metrics", params);

      if (error) {
        throw toTRPCError(error, "No se pudieron calcular las métricas");
      }

      return vTicket.metrics().parse(data);
    })
});
