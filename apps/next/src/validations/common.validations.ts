import { z } from "zod";

import type { ApiInputSchemas } from "@/types/http.types";

const inputsValidation = <T extends ApiInputSchemas>(inputs: T) => {
  return z.object({
    headers: z.object({}),
    searchParams: z.object({}),
    body: z.object({}),
    params: z.object({}),
    ...inputs
  });
};

export const vCommon = { inputs: inputsValidation };
