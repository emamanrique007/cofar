"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { navLinks, roleLabel } from "./AppNav.helpers";
import type { AppNavProps } from "./AppNav.types";
import { createBrowserClient } from "@/utils/supabase/supabase.client";

export const AppNav = (props: AppNavProps) => {
  const { accountName, email, isAgent, isOwner, role } = props;
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const links = navLinks(isAgent, isOwner);

  const logout = async () => {
    try {
      const { error: failure } = await createBrowserClient().auth.signOut();

      if (failure) {
        throw failure;
      }

      queryClient.clear();
      router.replace("/login");
      router.refresh();
    } catch {
      setError("No se pudo cerrar la sesión.");
    }
  };

  return (
    <header>
      <div className="top-strip">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-2">
          <span>{accountName || "Sin espacio activo"}</span>
          <span>{roleLabel(role, isAgent)}</span>
        </div>
      </div>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-6 px-6 py-4">
          <Link href="/tickets" aria-label="Cofar soporte">
            <span className="brand">
              cofar<span className="brand-plus">+</span>
            </span>
            <span className="brand-sub">soporte</span>
          </Link>
          <nav aria-label="Secciones" className="flex flex-wrap gap-1">
            {links.map(link => {
              const current = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  className={current ? "nav-link nav-link-active" : "nav-link"}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-4">
            <span className="text-sm text-muted">{email}</span>
            <button className="button-ghost" onClick={logout}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
      {error ? (
        <p role="alert" className="px-6 pt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </header>
  );
};
