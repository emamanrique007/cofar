import "server-only";
import type { Database } from "@cofar/types";
import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/config/env.server.config";

export const createAdminClient = () => {
  const env = getServerEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const auth = { persistSession: false, autoRefreshToken: false };

  return createClient<Database>(url, key, { auth });
};
