import { TRPCError } from "@trpc/server";

import { router, userProcedure } from "./trpc";
import { getPublicEnv } from "@/config/env.config";
import type { AgentShiftRow } from "@/types/ticket.types";
import { createAdminClient } from "@/utils/supabase/supabase.admin";
import { toTRPCError } from "@/utils/trpc.utils";
import { vAgent } from "@/validations/agents.validations";
import { vTicket } from "@/validations/tickets.validations";

const agentColumns = "user_id, availability, timezone, max_open_tickets";
const agentShift = "auto_assign, working_days, workday_start, workday_end";
const agentSelect = `${agentColumns}, ${agentShift}, last_assigned_at`;

const defaultTimezone = () => {
  return getPublicEnv().NEXT_PUBLIC_TIMEZONE ?? "UTC";
};

export const agentsRouter = router({
  me: userProcedure.input(vTicket.account()).query(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabase
      .from("ticket_agents")
      .select(agentSelect)
      .eq("account_id", input.accountId)
      .eq("user_id", ctx.user.id)
      .returns<AgentShiftRow[]>()
      .maybeSingle();

    if (error) {
      throw toTRPCError(error, "No se pudo cargar tu perfil de agente");
    }

    return data;
  }),
  list: userProcedure.input(vTicket.account()).query(async ({ ctx, input }) => {
    const members = await ctx.supabase
      .from("users_by_accounts")
      .select("user_id, role")
      .eq("account_id", input.accountId);

    if (members.error) {
      throw toTRPCError(members.error, "No se pudo cargar el equipo");
    }

    const ids = members.data.map(member => {
      return member.user_id;
    });
    const profiles = await ctx.supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", ids);

    if (profiles.error) {
      throw toTRPCError(profiles.error, "No se pudo cargar el equipo");
    }

    const agents = await ctx.supabase
      .from("ticket_agents")
      .select(agentSelect)
      .eq("account_id", input.accountId)
      .returns<AgentShiftRow[]>();

    if (agents.error) {
      throw toTRPCError(agents.error, "No se pudo cargar el equipo");
    }

    return members.data.map(member => {
      const profile = profiles.data.find(row => {
        return row.id === member.user_id;
      });
      const agent = agents.data.find(row => {
        return row.user_id === member.user_id;
      });
      const identity = {
        name: profile?.name ?? "",
        email: profile?.email ?? ""
      };

      return { ...member, ...identity, agent: agent ?? null };
    });
  }),
  create: userProcedure
    .input(vAgent.create())
    .mutation(async ({ ctx, input }) => {
      const membership = await ctx.supabase
        .from("users_by_accounts")
        .select("role")
        .eq("account_id", input.accountId)
        .eq("user_id", ctx.user.id)
        .maybeSingle();

      if (membership.error) {
        throw toTRPCError(membership.error, "No se pudo validar tu permiso");
      }

      if (membership.data?.role !== "owner") {
        const code = "FORBIDDEN" as const;
        const message = "Solo el administrador del espacio da de alta personas";

        throw new TRPCError({ code, message });
      }

      // Creating the login needs the service role; everything after it goes back
      // through the caller's client, so the database re-checks who is asking.
      const admin = createAdminClient();
      const access = { email: input.email, password: input.password };
      const profile = {
        email_confirm: true,
        user_metadata: { name: input.name }
      };
      const created = await admin.auth.admin.createUser({
        ...access,
        ...profile
      });

      if (created.error || !created.data.user) {
        const code = "BAD_REQUEST" as const;
        const message = "No se pudo crear el acceso. ¿Ese correo ya existe?";

        throw new TRPCError({ code, message });
      }

      const member = created.data.user.id;
      const invite = {
        target_account: input.accountId,
        member_email: input.email
      };
      const options = {
        make_agent: input.asAgent,
        agent_timezone: input.timezone
      };
      const added = await ctx.supabase.rpc("invite_account_member", {
        ...invite,
        ...options
      });

      if (added.error) {
        await admin.auth.admin.deleteUser(member);

        throw toTRPCError(
          added.error,
          "No se pudo sumar a la persona al espacio"
        );
      }

      if (!input.asAgent) {
        return { userId: member };
      }

      const p1 = { target_account: input.accountId, member };
      const p2 = { agent_timezone: input.timezone, days: input.days };
      const p3 = { day_start: input.start, day_end: input.end };
      const p4 = { max_open: input.maxOpen, auto: input.autoAssign };
      const p5 = { categories: input.categoryIds };
      const shift = { ...p1, ...p2, ...p3, ...p4, ...p5 };
      const saved = await ctx.supabase.rpc("configure_support_agent", shift);

      if (saved.error) {
        throw toTRPCError(
          saved.error,
          "La persona quedó creada, pero no su turno"
        );
      }

      return { userId: member };
    }),
  invite: userProcedure
    .input(vAgent.invite())
    .mutation(async ({ ctx, input }) => {
      const p1 = { target_account: input.accountId, member_email: input.email };
      const p2 = {
        make_agent: input.asAgent,
        agent_timezone: defaultTimezone()
      };
      const { data, error } = await ctx.supabase.rpc("invite_account_member", {
        ...p1,
        ...p2
      });

      if (error) {
        throw toTRPCError(error, "No se pudo sumar a la persona a la cuenta");
      }

      return { userId: data };
    }),
  setAgent: userProcedure
    .input(vAgent.membership())
    .mutation(async ({ ctx, input }) => {
      const p1 = { target_account: input.accountId, member: input.userId };
      const p2 = { enabled: input.enabled, agent_timezone: defaultTimezone() };
      const rpc = await ctx.supabase.rpc("set_support_agent", { ...p1, ...p2 });

      if (rpc.error) {
        throw toTRPCError(rpc.error, "No se pudo cambiar el rol de la persona");
      }

      return { changed: rpc.data };
    }),
  updateShift: userProcedure
    .input(vAgent.shift())
    .mutation(async ({ ctx, input }) => {
      const p1 = {
        target_account: input.accountId,
        next_availability: input.availability
      };
      const p2 = { agent_timezone: input.timezone, days: input.days };
      const p3 = { day_start: input.start, day_end: input.end };
      const p4 = { max_open: input.maxOpen, auto: input.autoAssign };
      const params = { ...p1, ...p2, ...p3, ...p4 };
      const rpc = await ctx.supabase.rpc("update_agent_shift", params);

      if (rpc.error) {
        throw toTRPCError(rpc.error, "No se pudo guardar tu jornada");
      }

      return { changed: rpc.data };
    })
});
