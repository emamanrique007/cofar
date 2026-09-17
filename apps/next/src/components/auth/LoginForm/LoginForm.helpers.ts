"use server";

import { redirect } from "next/navigation";

import type { LoginState } from "./LoginForm.types";
import { createServerClient } from "@/utils/supabase/supabase.server";
import { vAuth } from "@/validations/auth.validations";

export const login = async (_previous: LoginState, form: FormData) => {
  const email = form.get("email");
  const password = form.get("password");
  const parsed = vAuth.login().safeParse({ email, password });

  if (!parsed.success) {
    return { error: "Revisá el correo y la contraseña." };
  }

  try {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      return { error: "No se pudo ingresar. Revisá tus datos." };
    }
  } catch {
    return { error: "No se pudo conectar. Intentá nuevamente." };
  }

  redirect("/dashboard");
};
