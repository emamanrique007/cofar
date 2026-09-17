import type { PostgrestError } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";

// Postgres raises 42501 for authorization and 22023 for rejected transitions;
// anything else stays an internal error and never reaches the browser verbatim.
const errorCode = (error: PostgrestError) => {
  if (error.code === "42501") {
    return "FORBIDDEN" as const;
  }

  if (error.code === "22023") {
    return "BAD_REQUEST" as const;
  }

  return "INTERNAL_SERVER_ERROR" as const;
};

export const toTRPCError = (error: PostgrestError, message: string) => {
  const code = errorCode(error);

  return new TRPCError({ code, message, cause: error });
};
