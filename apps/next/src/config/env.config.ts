import { z } from "zod";

const required = z.string().min(1);
const optional = z.preprocess(value => {
  return value === "" ? undefined : value;
}, required.optional());
const min32 = required.min(32);

export const publicEnvVariables = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_ENV: z.enum(["develop", "production", "test"]),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required,
  NEXT_PUBLIC_TIMEZONE: optional
});

export const secretEnvVariables = z.object({
  CRON_AUTH_SECRET: min32,
  SUPABASE_SERVICE_ROLE_KEY: required
});

export const envVariables = publicEnvVariables.extend(secretEnvVariables.shape);

export const testEnvVariables = z.object({
  TEST_USER_EMAIL: z.email(),
  TEST_USER_PASSWORD: required.min(8)
});

// Explicit property access lets Next inline only the public browser configuration.
export const getPublicEnv = () => {
  return publicEnvVariables.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_TIMEZONE: process.env.NEXT_PUBLIC_TIMEZONE
  });
};
