import { vAccount } from "@/validations/accounts.validations";
import { vJob } from "@/validations/jobs.validations";

export const createAccountSchema = vAccount.create();
export const createAccountDefaults = { name: "" };
export const enqueueJobSchema = vJob.enqueueForm();
export const enqueueJobDefaults = { message: "" };
