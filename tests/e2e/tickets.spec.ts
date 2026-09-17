import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { createUser, login, removeAccount } from "./desk.helpers";
import { removeUsers, rpc, signIn } from "./desk.helpers";

const agentEmail = `agent-${randomUUID()}@example.test`;
const requesterEmail = `requester-${randomUUID()}@example.test`;
const title = "No puedo ingresar al sistema";
const description = "Olvide mi contraseña y el usuario quedo bloqueado ayer";
let agentId = "";
let requesterId = "";
let accountId = "";

test.beforeAll(async () => {
  agentId = await createUser(agentEmail, "Agente E2E");
  requesterId = await createUser(requesterEmail, "Solicitante E2E");

  const token = await signIn(agentEmail);
  const account = { account_name: "Cofar E2E Soporte", agent_timezone: "UTC" };

  accountId = await rpc(token, "create_account", account);

  const invite = { target_account: accountId, agent_timezone: "UTC" };
  const member = { member_email: requesterEmail, make_agent: false };

  await rpc(token, "invite_account_member", { ...invite, ...member });
});
test.afterAll(async () => {
  await removeAccount(accountId);
  await removeUsers([agentId, requesterId]);
});

const flow = "a request is classified, taken, resolved and closed";

test(flow, async ({ browser, request }) => {
  const requesterContext = await browser.newContext();
  const requester = await requesterContext.newPage();

  await login(requester, requesterEmail);
  await requester.goto("/tickets");
  await expect(
    requester.getByRole("heading", { name: "Mesa de ayuda" })
  ).toBeVisible();
  await expect(
    requester.getByRole("link", { name: "Cola de soporte" })
  ).toHaveCount(0);

  const chooser = requester.getByLabel("Categoría");

  await expect(chooser.locator("option")).toHaveCount(8);
  await requester.getByLabel("Título").fill(title);
  await requester.getByLabel("Descripción").fill(description);
  // On purpose: the wrong category, so the rules leave their disagreement.
  await requester
    .getByLabel("Categoría")
    .selectOption({ label: "Equipos y hardware" });
  await requester.getByRole("button", { name: "Crear solicitud" }).click();

  const receipt = requester.getByRole("status").first();

  await expect(receipt).toContainText("Equipos y hardware");
  await expect(
    requester.getByRole("link", { name: new RegExp(title) })
  ).toBeVisible();

  const agentContext = await browser.newContext();
  const agent = await agentContext.newPage();

  await login(agent, agentEmail);
  await agent.goto("/queue");
  await expect(
    agent.getByRole("link", { name: new RegExp(title) })
  ).toBeVisible();
  await agent.getByRole("button", { name: "Tomar" }).first().click();

  const row = agent.getByRole("listitem").filter({ hasText: title });

  await expect(row.getByText("Asignado", { exact: true })).toBeVisible();
  await agent.getByRole("link", { name: new RegExp(title) }).click();
  await expect(agent.getByRole("heading", { name: title })).toBeVisible();
  await agent.getByRole("button", { name: "Marcar resuelto" }).click();
  await expect(agent.getByText("Resuelto", { exact: true })).toBeVisible();
  await expect(agent.getByText("Sugerencia de las reglas")).toBeVisible();
  await expect(agent.getByText(/Las reglas sugerían accesos/)).toBeVisible();

  await requester.reload();
  await requester.getByRole("link", { name: new RegExp(title) }).click();

  const close = requester.getByRole("button", { name: "Cerrar", exact: true });

  await expect(close).toBeVisible();
  await close.click();
  await expect(requester.getByText("Cerrado", { exact: true })).toBeVisible();

  expect((await request.post("/api/cron/tickets")).status()).toBe(401);

  const secret = process.env.CRON_AUTH_SECRET;
  const options = { headers: { Authorization: `Bearer ${secret}` } };
  const response = await request.post("/api/cron/tickets", options);

  expect(response.ok()).toBe(true);

  const body = await response.json();

  expect(body.data).toHaveProperty("assigned");
  expect(body.data).toHaveProperty("breached_first_response");
  await requesterContext.close();
  await agentContext.close();
});
