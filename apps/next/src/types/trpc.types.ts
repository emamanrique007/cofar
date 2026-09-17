import type { Database } from "@cofar/types";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { appRouter } from "@/trpc";

export interface TRPCContext {
  supabase: SupabaseClient<Database>;
  user: User | null;
}
export type AppRouter = typeof appRouter;
