import { z } from "zod";

export const vAuth = {
  login: () => {
    return z.object({
      email: z.email("Ingresá un correo válido"),
      password: z.string().min(1, "Ingresá la contraseña").max(256)
    });
  }
};
