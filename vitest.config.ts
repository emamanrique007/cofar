import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = (path: string) => {
  return fileURLToPath(new URL(path, import.meta.url));
};

export default defineConfig({
  resolve: {
    alias: {
      "@": root("./apps/next/src"),
      "server-only": root("./tests/mocks/server-only.ts")
    }
  },
  test: { include: ["tests/**/*.test.ts"] }
});
