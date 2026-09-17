import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { testEnvVariables } from "../../apps/next/src/config/env.config";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

if (url !== "http://127.0.0.1:55321") {
  throw new Error("E2E only supports isolated local Cofar Supabase");
}

const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json"
};
const hasTestUser =
  !!process.env.TEST_USER_EMAIL || !!process.env.TEST_USER_PASSWORD;
const existing = hasTestUser ? testEnvVariables.parse(process.env) : undefined;
const email = existing?.TEST_USER_EMAIL ?? `e2e-${randomUUID()}@example.test`;
const password = existing?.TEST_USER_PASSWORD ?? randomUUID() + "aA1!";
let userId: string;
let accountId: string | undefined;

test.beforeAll(async () => {
  if (existing) {
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error("Existing local test user could not sign in");
    }

    userId = (await response.json()).user.id;
  } else {
    const response = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password, email_confirm: true })
    });

    if (!response.ok) {
      throw new Error(`Cannot create local E2E user: ${response.status}`);
    }

    userId = (await response.json()).id;
  }

  const token = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password })
  });

  if (!token.ok) {
    throw new Error(`Local login setup: ${await token.text()}`);
  }
});
test.afterAll(async () => {
  if (userId) {
    const rows = await fetch(
      `${url}/rest/v1/users_by_accounts?user_id=eq.${userId}&select=account_id`,
      {
        headers
      }
    ).then(r => {
      return r.json();
    });

    for (const row of rows) {
      if (existing && row.account_id !== accountId) {
        continue;
      }

      const deleted = await fetch(
        `${url}/rest/v1/accounts?id=eq.${row.account_id}`,
        { method: "DELETE", headers }
      );

      expect(deleted.ok).toBe(true);
    }

    if (existing) {
      return;
    }

    const deleted = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers
    });

    expect(deleted.ok).toBe(true);
  }
});
test("workspace and queue", async ({ page, request }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mi espacio de trabajo" })
  ).toBeVisible();
  await page.getByLabel("Nueva cuenta").fill("Cofar E2E");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByLabel("Cuenta activa")).toBeVisible();
  accountId = await page.getByLabel("Cuenta activa").inputValue();
  await page.getByLabel("Mensaje", { exact: true }).fill("Trabajo verificado");
  await page.getByRole("button", { name: "Enviar a la cola" }).click();
  await expect(page.getByText("En cola", { exact: true })).toBeVisible();
  expect((await request.post("/api/cron/jobs")).status()).toBe(401);

  const response = await request.post("/api/cron/jobs", {
    headers: { Authorization: `Bearer ${process.env.CRON_AUTH_SECRET}` }
  });

  expect(response.ok()).toBe(true);
  expect((await response.json()).data.completed).toBeGreaterThanOrEqual(1);
  await expect(page.getByText("Completado", { exact: true })).toBeVisible({
    timeout: 15000
  });

  const notifications = await fetch(
    `${url}/rest/v1/notifications?account_id=eq.${accountId}`,
    { headers }
  ).then(r => {
    return r.json();
  });

  expect(notifications).toHaveLength(1);
  expect(notifications[0].body).toBe("Trabajo verificado");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
