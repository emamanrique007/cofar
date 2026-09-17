"use client";

import type { Database } from "@cofar/types";
import { createBrowserClient as createClient } from "@supabase/ssr";

import { getPublicEnv } from "@/config/env.config";

export const createBrowserClient = () => {
  const env = getPublicEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return createClient<Database>(url, key);
};
