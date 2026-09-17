import { test, expect } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { createUser, login, readRows } from "./desk.helpers";
import { removeAccount, removeUsers, rpc } from "./desk.helpers";
import { runTicketsCron, signIn } from "./desk.helpers";

test.describe.configure({ mode: "serial" });

const ownerEmail = `routing-owner-${randomUUID()}@example.test`;
const agentEmail = `routing-agent-${randomUUID()}@example.test`;
const asksEmail = `routing-asks-${randomUUID()}@example.test`;
const otherEmail = `routing-other-${randomUUID()}@example.test`;
const firstTitle = "No puedo entrar al sistema de ventas";
const otherTitle = "Pedido de otra persona del equipo";
let ownerId = "";
let agentId = "";
let asksId = "";
let otherId = "";
let accountId = "";
let categoryId = "";
let asksToken = "";
let ownerPage: Page;
let asksPage: Page;

const openTicket = async (token: string, title: string) => {
  const p1 = { target_account: accountId, ticket_title: title };
  const p2 = { ticket_description: `${title} desde ayer a la mañana` };
  const p3 = { category: categoryId, source: "requester" };
  const created = await rpc(token, "create_ticket", { ...p1, ...p2, ...p3 });

  return String(created.ticket_id);
};

const ticketsOf = async (assignee: string) => {
  const columns = "select=id,status";
  const filter = `assignee_id=eq.${assignee}&status=in.(assigned,in_progress)`;

  return readRows(`tickets?${filter}&${columns}`);
};

const queued = async () => {
  const filter = `account_id=eq.${accountId}&status=eq.new`;

  return readRows(`tickets?${filter}&select=id,title`);
};

const drain = async (request: APIRequestContext) => {
  await runTicketsCron(request);
};

test.beforeAll(async ({ browser }) => {
  ownerId = await createUser(ownerEmail, "Dueña del espacio");
  agentId = await createUser(agentEmail, "Segundo agente");
  asksId = await createUser(asksEmail, "Quien pide");
  otherId = await createUser(otherEmail, "Otra persona");

  const ownerToken = await signIn(ownerEmail);
  const account = { account_name: "Cofar E2E Reparto", agent_timezone: "UTC" };

  accountId = await rpc(ownerToken, "create_account", account);

  const invite = { target_account: accountId, agent_timezone: "UTC" };

  await rpc(ownerToken, "invite_account_member", {
    ...invite,
    member_email: agentEmail,
    make_agent: true
  });
  await rpc(ownerToken, "invite_account_member", {
    ...invite,
    member_email: asksEmail,
    make_agent: false
  });
  await rpc(ownerToken, "invite_account_member", {
    ...invite,
    member_email: otherEmail,
    make_agent: false
  });

  // Both agents cover everything, are always on shift and hold two tickets each.
  const shift = { agent_timezone: "UTC", days: [0, 1, 2, 3, 4, 5, 6] };
  const hours = { day_start: "00:00", day_end: "23:59", max_open: 2 };
  const rest = { auto: true, categories: [] };

  for (const member of [ownerId, agentId]) {
    const p1 = { target_account: accountId, member };

    await rpc(ownerToken, "configure_support_agent", {
      ...p1,
      ...shift,
      ...hours,
      ...rest
    });
  }

  const path = `ticket_categories?account_id=eq.${accountId}&slug=eq.accesos`;
  const [category] = await readRows(`${path}&select=id`);

  categoryId = String(category?.id ?? "");
  asksToken = await signIn(asksEmail);
  ownerPage = await browser.newPage();
  asksPage = await browser.newPage();
  await login(ownerPage, ownerEmail);
  await login(asksPage, asksEmail);
});
test.afterAll(async () => {
  await ownerPage?.close();
  await asksPage?.close();
  await removeAccount(accountId);
  await removeUsers([ownerId, agentId, asksId, otherId]);
});

const routing = "a new request reaches an agent on its own through the cron";

test(routing, async ({ request }) => {
  await asksPage.goto(`/tickets?account=${accountId}`);
  await asksPage.getByLabel("Título").fill(firstTitle);
  await asksPage
    .getByLabel("Descripción")
    .fill("Se bloqueó mi usuario y no puedo facturar");
  await asksPage
    .getByLabel("Categoría")
    .selectOption({ label: "Accesos y contraseñas" });
  await asksPage.getByRole("button", { name: "Crear solicitud" }).click();
  await expect(asksPage.getByRole("status").first()).toContainText("Accesos");
  expect(await queued()).toHaveLength(1);
  await drain(request);
  expect(await queued()).toHaveLength(0);

  const filter = `account_id=eq.${accountId}&select=assignee_id,status`;
  const [ticket] = await readRows(`tickets?${filter}`);

  expect([ownerId, agentId]).toContain(ticket?.assignee_id);
  expect(ticket?.status).toBe("assigned");
  await ownerPage.goto(`/queue?account=${accountId}`);

  const row = ownerPage.getByRole("listitem").filter({ hasText: firstTitle });

  await expect(row.getByText("Asignado", { exact: true })).toBeVisible();
});

const sharing = "the queue is split evenly instead of piling on one agent";

test(sharing, async ({ request }) => {
  for (const title of ["Clave vencida", "Permisos de carpeta", "VPN caída"]) {
    await openTicket(asksToken, title);
  }

  await drain(request);
  expect(await ticketsOf(ownerId)).toHaveLength(2);
  expect(await ticketsOf(agentId)).toHaveLength(2);
});

const waiting = "past the load cap the ticket waits until somebody frees up";

test(waiting, async ({ request }) => {
  const extra = await openTicket(asksToken, "Usuario bloqueado en caja");

  await drain(request);

  const stillQueued = await queued();

  expect(stillQueued).toHaveLength(1);
  expect(stillQueued[0]?.id).toBe(extra);
  await ownerPage.goto(`/queue?account=${accountId}`);

  const row = ownerPage
    .getByRole("listitem")
    .filter({ hasText: "Usuario bloqueado en caja" });

  await expect(row.getByText("En cola", { exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "Tomar" })).toBeVisible();

  const [mine] = await ticketsOf(ownerId);

  await ownerPage.goto(`/tickets/${mine?.id}?account=${accountId}`);
  await ownerPage.getByRole("button", { name: "Marcar resuelto" }).click();
  await expect(ownerPage.getByText("Resuelto", { exact: true })).toBeVisible();
  await drain(request);

  const path = `tickets?id=eq.${extra}&select=assignee_id,status`;
  const [assigned] = await readRows(path);

  expect(assigned?.assignee_id).toBe(ownerId);
  expect(assigned?.status).toBe("assigned");
});

const numbers = "the dashboard shows the same numbers the table holds";

test(numbers, async () => {
  const open = "status=in.(new,assigned,in_progress)";
  const openRows = await readRows(
    `tickets?account_id=eq.${accountId}&${open}&select=id`
  );
  const queuedRows = await queued();

  await ownerPage.goto(`/metrics?account=${accountId}`);

  const card = ownerPage
    .locator(".card")
    .filter({ has: ownerPage.getByText("Abiertos", { exact: true }) });
  const unassignedCard = ownerPage
    .locator(".card")
    .filter({ has: ownerPage.getByText("Sin asignar", { exact: true }) });

  await expect(card.locator("p").nth(1)).toHaveText(String(openRows.length));
  await expect(unassignedCard.locator("p").nth(1)).toHaveText(
    String(queuedRows.length)
  );
});

const privacy = "each profile only reaches what it is allowed to see";

test(privacy, async ({ browser }) => {
  const otherToken = await signIn(otherEmail);
  const otherTicket = await openTicket(otherToken, otherTitle);

  await asksPage.goto(`/tickets?account=${accountId}`);

  const list = asksPage.getByRole("listitem");

  await expect(list.filter({ hasText: firstTitle })).toBeVisible();
  await expect(list.filter({ hasText: otherTitle })).toHaveCount(0);
  await asksPage.goto(`/tickets/${otherTicket}?account=${accountId}`);
  await expect(asksPage.getByText("El ticket no existe")).toBeVisible();
  await asksPage.goto(`/queue?account=${accountId}`);
  await expect(asksPage).toHaveURL(/\/tickets$/);
  await asksPage.goto(`/metrics?account=${accountId}`);
  await expect(asksPage).toHaveURL(/\/tickets$/);
  await asksPage.goto(`/team?account=${accountId}`);
  await expect(asksPage).toHaveURL(/\/tickets$/);

  const context = await browser.newContext();
  const page = await context.newPage();

  await login(page, agentEmail);
  await page.goto(`/queue?account=${accountId}`);
  await expect(
    page.getByRole("listitem").filter({ hasText: otherTitle })
  ).toBeVisible();
  await page.goto(`/team?account=${accountId}`);
  await expect(page.getByText("Mi jornada")).toBeVisible();
  await expect(page.getByText("Dar de alta a una persona")).toHaveCount(0);
  await context.close();
});
