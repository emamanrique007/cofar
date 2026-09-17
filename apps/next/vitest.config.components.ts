import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": src }
  },
  test: {
    environment: "happy-dom",
    include: ["./src/components/**/*.test.tsx"],
    setupFiles: ["./src/test/components.setup.tsx"]
  }
});
