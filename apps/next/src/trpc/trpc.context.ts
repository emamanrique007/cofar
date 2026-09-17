import type { TRPCContext } from "@/types/trpc.types";
import { createServerClient } from "@/utils/supabase/supabase.server";

export const createContext = async (): Promise<TRPCContext> => {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();

  return { supabase, user: data.user };
};
