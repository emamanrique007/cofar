import { TRPCError } from "@trpc/server";

import { router, userProcedure } from "./trpc";
import { accountInput, jobInput } from "@/validations/jobs.validations";

export const jobsRouter = router({
  list: userProcedure.input(accountInput).query(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabase
      .from("jobs")
      .select("*")
      .eq("account_id", input.accountId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      const code = "INTERNAL_SERVER_ERROR" as const;
      const message = "No se pudieron cargar los trabajos";

      throw new TRPCError({ code, message, cause: error });
    }

    return data;
  }),
  enqueue: userProcedure.input(jobInput).mutation(async ({ ctx, input }) => {
    const target_account = input.accountId;
    const request_key = input.requestId;
    const body = input.message;
    const params = { target_account, request_key, body };
    const { data, error } = await ctx.supabase.rpc("enqueue_job", params);

    if (error) {
      const forbidden = error.code === "42501";
      const code = forbidden ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR";
      const message = "No se pudo encolar el trabajo";

      throw new TRPCError({ code, message, cause: error });
    }

    return data;
  })
});
