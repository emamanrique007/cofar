import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const destination = "apps/next/.env.local";

if (existsSync(destination)) {
  throw new Error(
    ".env.local already exists; preserve it and configure manually"
  );
}

const stdout = execFileSync(
  resolve("node_modules/.bin/supabase"),
  ["status", "-o", "json"],
  {
    cwd: "apps/next",
    encoding: "utf8"
  }
);
const status = JSON.parse(stdout);

if (status.API_URL !== "http://127.0.0.1:55321") {
  throw new Error("Expected isolated local Cofar Supabase");
}

const values = {
  NEXT_PUBLIC_ENV: "develop",
  NEXT_PUBLIC_APP_URL: "http://localhost:3005",
  NEXT_PUBLIC_TIMEZONE: "America/Argentina/Tucuman",
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  CRON_AUTH_SECRET: randomBytes(32).toString("hex")
};

if (
  Object.values(values).some(value => {
    return !value;
  })
) {
  throw new Error("Missing local environment values");
}

writeFileSync(
  destination,
  Object.entries(values)
    .map(([key, value]) => {
      return `${key}=${value}`;
    })
    .join("\n") + "\n",
  { mode: 0o600, flag: "wx" }
);
console.log(
  "Local Cofar environment configured; credentials were not printed."
);
