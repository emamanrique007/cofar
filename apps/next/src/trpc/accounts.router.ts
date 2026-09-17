import { TRPCError } from "@trpc/server";

import { router, userProcedure } from "./trpc";
import { vAccount } from "@/validations/accounts.validations";

export const accountsRouter = router({
  list: userProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("accounts")
      .select("*")
      .order("created_at");

    if (error) {
      const code = "INTERNAL_SERVER_ERROR" as const;
      const message = "No se pudieron cargar las cuentas";

      throw new TRPCError({ code, message, cause: error });
    }

    return data;
  }),
  create: userProcedure
    .input(vAccount.create())
    .mutation(async ({ ctx, input }) => {
      const params = { account_name: input.name };
      const { data, error } = await ctx.supabase.rpc("create_account", params);

      if (error) {
        const code = "INTERNAL_SERVER_ERROR" as const;
        const message = "No se pudo crear la cuenta";

        throw new TRPCError({ code, message, cause: error });
      }

      return data;
    })
});
