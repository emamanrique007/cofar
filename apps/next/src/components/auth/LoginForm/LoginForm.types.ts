import type { z } from "zod";

import { vAuth } from "@/validations/auth.validations";

export interface LoginState {
  error: string;
}

const loginSchema = vAuth.login();

export type SchemaInput = z.input<typeof loginSchema>;
export type SchemaOutput = z.output<typeof loginSchema>;
