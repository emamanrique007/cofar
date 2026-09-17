import "server-only";
import type { Database } from "@cofar/types";
import { createServerClient as createClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/config/env.config";

export const createServerClient = async () => {
  const store = await cookies();
  const env = getPublicEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const cookieAdapter = {
    getAll: () => {
      return store.getAll();
    },
    setAll: (
      values: {
        name: string;
        value: string;
        options: Parameters<typeof store.set>[2];
      }[]
    ) => {
      try {
        for (const { name, value, options } of values) {
          store.set(name, value, options);
        }
      } catch {
        /* Server Components cannot write cookies; proxy refreshes the session. */
      }
    }
  };

  return createClient<Database>(url, key, { cookies: cookieAdapter });
};
