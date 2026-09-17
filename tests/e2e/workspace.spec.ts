import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { createUser, login, readRows } from "./desk.helpers";
import { removeAccount, removeUsers, rpc, signIn } from "./desk.helpers";

const email = `workspace-${randomUUID()}@example.test`;
let userId = "";
let accountId = "";

test.beforeAll(async () => {
  userId = await createUser(email, "Dueña del espacio");
});
test.afterAll(async () => {
  await removeAccount(accountId);
  await removeUsers([userId]);
});

const flow = "a space is created, entered, and its queue still runs";

test(flow, async ({ page, request }) => {
  await page.goto("/tickets");
  await expect(page).toHaveURL(/\/login$/);
  await login(page, email);
  await expect(
    page.getByRole("heading", { name: "Mis espacios" })
  ).toBeVisible();
  await page.getByLabel("Nombre del espacio").fill("Cofar E2E Espacio");
  await page.getByRole("button", { name: "Crear espacio" }).click();
  await expect(page).toHaveURL(/\/tickets\?account=/);

  accountId = new URL(page.url()).searchParams.get("account") ?? "";

  expect(accountId).not.toBe("");
  await expect(
    page.getByRole("heading", { name: "Mesa de ayuda" })
  ).toBeVisible();

  const token = await signIn(email);
  const p1 = { target_account: accountId, request_key: randomUUID() };
  const job = { ...p1, body: "Trabajo verificado" };

  await rpc(token, "enqueue_job", job);
  expect((await request.post("/api/cron/jobs")).status()).toBe(401);

  const secret = process.env.CRON_AUTH_SECRET;
  const options = { headers: { Authorization: `Bearer ${secret}` } };
  const response = await request.post("/api/cron/jobs", options);

  expect(response.ok()).toBe(true);
  expect((await response.json()).data.completed).toBeGreaterThanOrEqual(1);

  const path = `notifications?account_id=eq.${accountId}&select=body`;
  const notifications = await readRows(path);

  expect(notifications).toHaveLength(1);
  expect(notifications[0]?.body).toBe("Trabajo verificado");
  await page.goto("/dashboard");
  await expect(
    page.getByRole("button", { name: /Cofar E2E Espacio/ })
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/tickets");
  await expect(page).toHaveURL(/\/login$/);
});
