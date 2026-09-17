import { afterEach, expect, test, vi } from "vitest";

import { publicEnvVariables } from "@/config/env.config";
import { envVariables, getPublicEnv } from "@/config/env.config";
import { secretEnvVariables, testEnvVariables } from "@/config/env.config";

const publicEnv = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3005",
  NEXT_PUBLIC_ENV: "test",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-public-fixture"
};
const secrets = {
  CRON_AUTH_SECRET: "s".repeat(32),
  SUPABASE_SERVICE_ROLE_KEY: "local-private-fixture"
};

afterEach(() => {
  return vi.unstubAllEnvs();
});

test("public environment requires valid URLs and permits an empty optional timezone", () => {
  const input = { ...publicEnv, NEXT_PUBLIC_TIMEZONE: "" };

  expect(publicEnvVariables.parse(input).NEXT_PUBLIC_TIMEZONE).toBeUndefined();
  expect(publicEnvVariables.safeParse({}).success).toBe(false);

  const malformed = { ...publicEnv, NEXT_PUBLIC_SUPABASE_URL: "invalid" };

  expect(publicEnvVariables.safeParse(malformed).success).toBe(false);
});

test("required secrets fail validation before worker or service-role access", () => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", secrets.SUPABASE_SERVICE_ROLE_KEY);
  vi.stubEnv("CRON_AUTH_SECRET", "short");
  expect(() => {
    return secretEnvVariables.parse(process.env);
  }).toThrow();
  vi.stubEnv("CRON_AUTH_SECRET", secrets.CRON_AUTH_SECRET);
  expect(secretEnvVariables.parse(process.env)).toEqual(secrets);
  expect(envVariables.safeParse({ ...publicEnv, ...secrets }).success).toBe(
    true
  );
});

test("browser environment never returns service-role or cron secrets", () => {
  for (const [key, value] of Object.entries({ ...publicEnv, ...secrets })) {
    vi.stubEnv(key, value);
  }

  const result = getPublicEnv();

  expect(result).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
  expect(result).not.toHaveProperty("CRON_AUTH_SECRET");
  expect(JSON.stringify(result)).not.toContain(
    secrets.SUPABASE_SERVICE_ROLE_KEY
  );
});

test("test credentials are validated without exposing them as NEXT_PUBLIC fields", () => {
  const valid = {
    TEST_USER_EMAIL: "test@example.test",
    TEST_USER_PASSWORD: "test-password"
  };

  expect(testEnvVariables.safeParse(valid).success).toBe(true);
  expect(testEnvVariables.safeParse({}).success).toBe(false);
});
