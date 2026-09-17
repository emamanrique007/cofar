import { test, expect } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { createUser, login, patchRows, readRows } from "./desk.helpers";
import { removeAccount, removeUsers, rpc } from "./desk.helpers";
import { runTicketsCron, signIn } from "./desk.helpers";

test.describe.configure({ mode: "serial" });

const agentEmail = `desk-agent-${randomUUID()}@example.test`;
const requesterEmail = `desk-requester-${randomUUID()}@example.test`;
const routed = "Teclado sin respuesta en el puesto cuatro";
const parked = "Silla rota en la sala de reuniones";
const late = "Monitor parpadea todo el tiempo";
const fixed = "Consulta sobre el tramite iniciado";
let agentId = "";
let requesterId = "";
let accountId = "";
let requesterToken = "";
let hiredId = "";
let agentPage: Page;

const openTicket = async (title: string, description: string) => {
  const p1 = { target_account: accountId, ticket_title: title };
  const p2 = { ticket_description: description, source: "requester" };

  return rpc(requesterToken, "create_ticket", { ...p1, ...p2 });
};

const readTicket = async (ticketId: string) => {
  const columns = "status,assignee_id,first_responded_at,priority,category_id";
  const sla = "first_response_due_at,first_response_breached_at";
  const sla2 = "resolution_breached_at,category_source";
  const path = `tickets?id=eq.${ticketId}&select=${columns},${sla},${sla2}`;
  const [row] = await readRows(path);

  return row;
};

const readEvents = async (ticketId: string, type: string) => {
  const filter = `ticket_id=eq.${ticketId}&type=eq.${type}`;

  return readRows(`ticket_events?${filter}&select=actor_id,to_value,detail`);
};

// The worker batches 25 tickets per run, so unrelated local data may need more.
const routeTicket = async (request: APIRequestContext, ticketId: string) => {
  for (let attempt = 0; attempt < 3; attempt = attempt + 1) {
    const result = await runTicketsCron(request);
    const ticket = await readTicket(ticketId);

    if (ticket.assignee_id) {
      return { ticket, result };
    }
  }

  return { ticket: await readTicket(ticketId), result: null };
};

const saveAvailability = async (page: Page, label: string) => {
  await page.goto("/team");
  await page.getByLabel("Disponibilidad").selectOption({ label });
  await page.getByRole("button", { name: "Guardar jornada" }).click();
  await expect(page.getByText("Jornada guardada.")).toBeVisible();
};

test.beforeAll(async ({ browser }) => {
  agentId = await createUser(agentEmail, "Agente de turno");
  requesterId = await createUser(requesterEmail, "Persona solicitante");

  const agentToken = await signIn(agentEmail);
  const account = { account_name: "Cofar E2E Mesa", agent_timezone: "UTC" };

  accountId = await rpc(agentToken, "create_account", account);

  const invite = { target_account: accountId, agent_timezone: "UTC" };
  const member = { member_email: requesterEmail, make_agent: false };

  await rpc(agentToken, "invite_account_member", { ...invite, ...member });

  const shift = { target_account: accountId, next_availability: "available" };
  const hours = { agent_timezone: "UTC", day_start: "00:00", day_end: "23:59" };
  const load = { days: [0, 1, 2, 3, 4, 5, 6], max_open: 5, auto: true };

  await rpc(agentToken, "update_agent_shift", { ...shift, ...hours, ...load });
  requesterToken = await signIn(requesterEmail);
  agentPage = await browser.newPage();
  await login(agentPage, agentEmail);
});
test.afterAll(async () => {
  await agentPage?.close();
  await removeAccount(accountId);
  await removeUsers([agentId, requesterId, hiredId]);
});

const routing = "the worker routes a new ticket to the agent on shift";

test(routing, async ({ request }) => {
  const created = await openTicket(routed, "El teclado no responde desde hoy");
  const before = await readTicket(created.ticket_id);

  expect(before.status).toBe("new");
  expect(before.assignee_id).toBeNull();

  const run = await routeTicket(request, created.ticket_id);

  expect(run.result?.assigned).toBeGreaterThanOrEqual(1);
  expect(run.ticket.assignee_id).toBe(agentId);
  expect(run.ticket.status).toBe("assigned");
  // Routing is not an answer: the first response clock must keep running.
  expect(run.ticket.first_responded_at).toBeNull();

  const [event] = await readEvents(created.ticket_id, "assigned");

  expect(event.actor_id).toBeNull();
  expect(event.detail).toEqual({ mode: "auto" });
  await agentPage.goto("/queue");

  const row = agentPage.getByRole("listitem").filter({ hasText: routed });

  await expect(row.getByText("Asignado", { exact: true })).toBeVisible();
  await agentPage.getByRole("link", { name: new RegExp(routed) }).click();
  await expect(agentPage.getByText("por asignación automática")).toBeVisible();
});

const parking = "a busy agent leaves the ticket queued until they are back";

test(parking, async ({ request }) => {
  await saveAvailability(agentPage, "Ocupado");

  const [shift] = await readRows(
    `ticket_agents?user_id=eq.${agentId}&select=availability,working_days`
  );

  expect(shift.availability).toBe("busy");
  expect(shift.working_days).toEqual([0, 1, 2, 3, 4, 5, 6]);

  const created = await openTicket(parked, "La silla de la sala esta rota");
  const result = await runTicketsCron(request);
  const queued = await readTicket(created.ticket_id);

  expect(queued.status).toBe("new");
  expect(queued.assignee_id).toBeNull();
  expect(result.unroutable).toBeGreaterThanOrEqual(1);
  await saveAvailability(agentPage, "Disponible");

  const run = await routeTicket(request, created.ticket_id);

  expect(run.ticket.assignee_id).toBe(agentId);
});

test("the sweep marks each overdue target once", async ({ request }) => {
  const created = await openTicket(late, "El monitor parpadea sin parar hoy");
  const past = new Date(Date.now() - 3600000).toISOString();
  const overdue = { first_response_due_at: past, resolution_due_at: past };

  await patchRows(`tickets?id=eq.${created.ticket_id}`, overdue);

  const result = await runTicketsCron(request);

  expect(result.breached_first_response).toBeGreaterThanOrEqual(1);
  expect(result.breached_resolution).toBeGreaterThanOrEqual(1);

  const ticket = await readTicket(created.ticket_id);

  expect(ticket.first_response_breached_at).not.toBeNull();
  expect(ticket.resolution_breached_at).not.toBeNull();
  expect(await readEvents(created.ticket_id, "sla_breached")).toHaveLength(2);
  await runTicketsCron(request);
  expect(await readEvents(created.ticket_id, "sla_breached")).toHaveLength(2);
  await agentPage.goto("/queue");
  await agentPage.getByLabel("Solo vencidos").check();

  const row = agentPage.getByRole("listitem").filter({ hasText: late });

  await expect(row).toBeVisible();
  await expect(row.getByText(/1ª respuesta/)).toBeVisible();
  // The breached target is the one painted in red, not merely listed.
  await expect(row.locator(".badge-danger")).toBeVisible();
  await agentPage.getByLabel("Solo vencidos").uncheck();
  await agentPage.goto("/metrics");

  const card = agentPage.locator(".card").filter({ hasText: "Vencidos" });
  const value = await card.locator("p").nth(1).textContent();

  expect(Number(value)).toBeGreaterThanOrEqual(1);
});

const restating =
  "correcting the category and the priority restates the promise";

test(restating, async () => {
  const created = await openTicket(fixed, "Queria saber como sigue el pedido");
  const before = await readTicket(created.ticket_id);

  expect(before.category_source).toBe("requester");
  await agentPage.goto(`/tickets/${created.ticket_id}`);
  await agentPage
    .getByLabel("Corregir categoría")
    .selectOption({ label: "Compras y facturación" });
  await expect(agentPage.getByText("Categoría corregida")).toBeVisible();
  await agentPage.getByLabel("Prioridad").selectOption({ label: "Urgente" });
  await expect(agentPage.getByText("Cambio de prioridad")).toBeVisible();

  const after = await readTicket(created.ticket_id);
  const first = Date.parse(String(after.first_response_due_at));
  const original = Date.parse(String(before.first_response_due_at));

  expect(after.category_source).toBe("agent");
  expect(after.priority).toBe("urgent");
  expect(first).toBeLessThan(original);
});

test("the worker route keeps its HTTP contract", async ({ request }) => {
  const secret = process.env.CRON_AUTH_SECRET;
  const auth = { Authorization: `Bearer ${secret}` };
  const wrong = { Authorization: `Bearer ${"x".repeat(32)}` };
  const json = { ...auth, "Content-Type": "application/json" };
  // A raw buffer keeps the bytes malformed; a string would be serialized first.
  const broken = Buffer.from("{");

  expect((await request.post("/api/cron/tickets")).status()).toBe(401);
  expect(
    (await request.post("/api/cron/tickets", { headers: wrong })).status()
  ).toBe(401);
  expect(
    (
      await request.post("/api/cron/tickets", { headers: json, data: broken })
    ).status()
  ).toBe(400);
  expect(
    (
      await request.post("/api/cron/tickets", {
        headers: json,
        data: { batch: 3 }
      })
    ).status()
  ).toBe(422);

  const response = await request.post("/api/cron/tickets", { headers: auth });
  const body = await response.json();
  const keys = Object.keys(body.data).sort();

  expect(response.status()).toBe(200);
  expect(keys).toEqual([
    "assigned",
    "breached_first_response",
    "breached_resolution",
    "pending",
    "unroutable"
  ]);
});

const hiring = "the owner hires an agent who can sign in and work the queue";

test(hiring, async ({ browser }) => {
  const email = `hired-${randomUUID()}@example.test`;
  const secret = `${randomUUID()}aA1!`;

  await agentPage.goto("/team");
  await agentPage.getByLabel("Nombre").fill("Agente contratada");
  await agentPage.getByLabel("Correo").fill(email);
  await agentPage.getByLabel("Contraseña").fill(secret);
  await agentPage.getByLabel("Accesos y contraseñas").check();
  await agentPage.getByRole("button", { name: "Crear acceso" }).click();
  await expect(agentPage.getByText(/ya puede ingresar/)).toBeVisible();

  const [profile] = await readRows(`profiles?email=eq.${email}&select=id`);

  hiredId = String(profile?.id ?? "");
  expect(hiredId).not.toBe("");

  const shiftPath = `ticket_agents?user_id=eq.${hiredId}&select=category_ids`;
  const [shift] = await readRows(shiftPath);
  const covered = (shift?.category_ids ?? []) as string[];

  expect(covered).toHaveLength(1);

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(secret);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: /Cofar E2E Mesa/ }).click();
  await page.goto("/queue");
  await expect(
    page.getByRole("heading", { name: "Cola de soporte" }).first()
  ).toBeVisible();
  await context.close();
});
