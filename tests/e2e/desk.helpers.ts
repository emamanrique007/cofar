import { expect } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

if (supabaseUrl !== "http://127.0.0.1:55321") {
  throw new Error("E2E only supports isolated local Cofar Supabase");
}

const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const serviceHeaders = {
  apikey: service,
  Authorization: `Bearer ${service}`
};
export const password = `${randomUUID()}aA1!`;

const json = { "Content-Type": "application/json" };

export const createUser = async (email: string, name: string) => {
  const payload = { email, password, email_confirm: true };
  const body = JSON.stringify({ ...payload, user_metadata: { name } });
  const headers = { ...serviceHeaders, ...json };
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body
  });

  if (!response.ok) {
    throw new Error(`Cannot create local E2E user: ${response.status}`);
  }

  return (await response.json()).id as string;
};

export const signIn = async (email: string) => {
  const body = JSON.stringify({ email, password });
  const headers = { apikey: anon, ...json };
  const endpoint = `${supabaseUrl}/auth/v1/token?grant_type=password`;
  const response = await fetch(endpoint, { method: "POST", headers, body });

  if (!response.ok) {
    throw new Error(`Local login setup: ${await response.text()}`);
  }

  return (await response.json()).access_token as string;
};

export const rpc = async (token: string, name: string, args: unknown) => {
  const auth = { apikey: anon, Authorization: `Bearer ${token}` };
  const headers = { ...auth, ...json };
  const body = JSON.stringify(args);
  const endpoint = `${supabaseUrl}/rest/v1/rpc/${name}`;
  const response = await fetch(endpoint, { method: "POST", headers, body });

  if (!response.ok) {
    throw new Error(`${name}: ${await response.text()}`);
  }

  return JSON.parse((await response.text()) || "null");
};

// Service-role reads and writes: assertions and fixtures must not depend on RLS.
export const readRows = async (path: string) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: serviceHeaders
  });

  if (!response.ok) {
    throw new Error(`select ${path}: ${await response.text()}`);
  }

  return (await response.json()) as Record<string, unknown>[];
};

export const patchRows = async (path: string, values: unknown) => {
  const headers = { ...serviceHeaders, ...json, Prefer: "return=minimal" };
  const body = JSON.stringify(values);
  const endpoint = `${supabaseUrl}/rest/v1/${path}`;
  const response = await fetch(endpoint, { method: "PATCH", headers, body });

  if (!response.ok) {
    throw new Error(`patch ${path}: ${await response.text()}`);
  }
};

export const removeAccount = async (accountId: string) => {
  const endpoint = `${supabaseUrl}/rest/v1/accounts?id=eq.${accountId}`;

  await fetch(endpoint, { method: "DELETE", headers: serviceHeaders });
};

export const removeUsers = async (ids: string[]) => {
  for (const id of ids) {
    if (id) {
      const endpoint = `${supabaseUrl}/auth/v1/admin/users/${id}`;

      await fetch(endpoint, { method: "DELETE", headers: serviceHeaders });
    }
  }
};

export const login = async (page: Page, email: string) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
};

export const runTicketsCron = async (request: APIRequestContext) => {
  const secret = process.env.CRON_AUTH_SECRET;
  const options = { headers: { Authorization: `Bearer ${secret}` } };
  const response = await request.post("/api/cron/tickets", options);

  expect(response.ok()).toBe(true);

  return (await response.json()).data;
};
