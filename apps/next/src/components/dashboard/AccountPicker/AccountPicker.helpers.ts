import { vAccount } from "@/validations/accounts.validations";

export const accountSchema = vAccount.create();
export const accountDefaults = { name: "" };
