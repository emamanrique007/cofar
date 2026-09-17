import { z } from "zod";

export const vAccount = {
  create: () => {
    return z.object({
      name: z.string().trim().min(2, "Usá al menos 2 caracteres").max(100)
    });
  }
};
