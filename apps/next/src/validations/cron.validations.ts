import { z } from "zod";

import { vCommon } from "./common.validations";

const jobsValidation = () => {
  const headers = z.object({ authorization: z.string().optional() });
  const body = z.strictObject({});

  return vCommon.inputs({ headers, body });
};

const resultValidation = () => {
  return z.object({
    read: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    stale: z.number().int().nonnegative()
  });
};

export const vCron = { jobs: jobsValidation, result: resultValidation };
