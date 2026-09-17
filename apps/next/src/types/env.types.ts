import type { z } from "zod";

import type { envVariables, testEnvVariables } from "@/config/env.config";

export type EnvVariables = z.infer<typeof envVariables>;
export type TestEnvVariables = z.infer<typeof testEnvVariables>;

declare global {
  namespace NodeJS {
    // Values are untrusted until Zod validates them at the relevant boundary.
    interface ProcessEnv
      extends Partial<EnvVariables>, Partial<TestEnvVariables> {}
  }
}
