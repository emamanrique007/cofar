import type { Database } from "@cofar/types";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getPublicEnv } from "@/config/env.config";

export const proxy = async (request: NextRequest) => {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const cookieAdapter = {
    getAll: () => {
      return request.cookies.getAll();
    },
    setAll: (
      values: {
        name: string;
        value: string;
        options: Parameters<typeof response.cookies.set>[2];
      }[]
    ) => {
      for (const { name, value } of values) {
        request.cookies.set(name, value);
      }

      response = NextResponse.next({ request });

      for (const { name, value, options } of values) {
        response.cookies.set(name, value, options);
      }
    }
  };
  const options = { cookies: cookieAdapter };
  const supabase = createServerClient<Database>(url, key, options);

  await supabase.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");

  return response;
};

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/api/trpc/:path*"]
};
