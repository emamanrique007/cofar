import { execFileSync } from "node:child_process";
import { writeFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";

const destination = "packages/types/src/generated-database.types.ts";
const args = ["gen", "types", "typescript", "--schema", "public"];

if (process.argv.includes("--remote")) {
  const projectId = process.env.SUPABASE_PROJECT_ID;

  if (!projectId) {
    throw new Error(
      "SUPABASE_PROJECT_ID is required for remote type generation"
    );
  }

  args.push("--project-id", projectId);
} else {
  args.push("--local");
}

const executable = resolve("node_modules/.bin/supabase");
const stdio = ["ignore", "pipe", "inherit"];
const options = { cwd: "apps/next", encoding: "utf8", stdio };
const result = execFileSync(executable, args, options);

if (!result.includes("export type Database")) {
  throw new Error("Database type generation failed");
}

writeFileSync(`${destination}.tmp`, result);
renameSync(`${destination}.tmp`, destination);
