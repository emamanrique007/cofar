import { readFileSync } from "node:fs";
import { resolve } from "node:path";

process.loadEnvFile("apps/next/.env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const timezone = process.env.NEXT_PUBLIC_TIMEZONE ?? "UTC";
const local = url.includes("127.0.0.1") || url.includes("localhost");

if (!local) {
  throw new Error("El seed de demo solo corre contra el Supabase local");
}

const dist = resolve("packages/utils/dist/index.js");

try {
  readFileSync(dist);
} catch {
  throw new Error("Ejecutá pnpm compile antes del seed de demo");
}

const { classifyTicket } = await import(dist);
const password = "cofar1234";
const admin = { apikey: service, Authorization: `Bearer ${service}` };
const json = { "Content-Type": "application/json" };

const createUser = async (email, name) => {
  const metadata = { name };
  const payload = { email, password, email_confirm: true };
  const body = JSON.stringify({ ...payload, user_metadata: metadata });
  const options = { method: "POST", headers: { ...admin, ...json }, body };
  const created = await fetch(`${url}/auth/v1/admin/users`, options);

  if (created.ok) {
    return (await created.json()).id;
  }

  const listed = await fetch(`${url}/auth/v1/admin/users?per_page=500`, {
    headers: admin
  });
  const users = (await listed.json()).users;
  const found = users.find(user => {
    return user.email === email;
  });

  if (!found) {
    throw new Error(`No se pudo crear ni encontrar ${email}`);
  }

  return found.id;
};

const signIn = async email => {
  const body = JSON.stringify({ email, password });
  const headers = { apikey: anon, ...json };
  const endpoint = `${url}/auth/v1/token?grant_type=password`;
  const response = await fetch(endpoint, { method: "POST", headers, body });

  if (!response.ok) {
    throw new Error(`No se pudo iniciar sesión con ${email}`);
  }

  return (await response.json()).access_token;
};

const rpc = async (token, name, args) => {
  const headers = { apikey: anon, Authorization: `Bearer ${token}`, ...json };
  const options = { method: "POST", headers, body: JSON.stringify(args) };
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, options);

  if (!response.ok) {
    throw new Error(`${name}: ${await response.text()}`);
  }

  const text = await response.text();

  return text ? JSON.parse(text) : null;
};

const select = async (token, path) => {
  const headers = { apikey: anon, Authorization: `Bearer ${token}` };
  const response = await fetch(`${url}/rest/v1/${path}`, { headers });

  if (!response.ok) {
    throw new Error(`select ${path}: ${await response.text()}`);
  }

  return response.json();
};

const drafts = [
  {
    title: "No puedo ingresar al sistema",
    description:
      "Olvide mi contraseña y el usuario quedo bloqueado despues de tres intentos."
  },
  {
    title: "La impresora del segundo piso no enciende",
    description:
      "La impresora no enciende desde ayer, probamos con otro cable y nada."
  },
  {
    title: "Necesito la licencia de Office",
    description:
      "Me pide activar office al abrir excel y no me deja guardar los archivos."
  },
  {
    title: "Internet intermitente en ventas",
    description:
      "La conexion a internet se corta cada diez minutos en todo el sector."
  },
  {
    title: "Certificado por licencia medica",
    description:
      "Adjunto el certificado de mi licencia medica de la semana pasada."
  },
  {
    title: "Consulta sobre una compra",
    description:
      "Queria saber como sigue el tramite que inicie la semana pasada."
  }
];

const adminId = await createUser("admin@cofar.test", "Ana Admin");
const agentId = await createUser("agente@cofar.test", "Bruno Agente");
const requesterId = await createUser(
  "solicitante@cofar.test",
  "Carla Solicitante"
);
const adminToken = await signIn("admin@cofar.test");
const accountName = `Mesa de ayuda ${new Date().toISOString().slice(0, 10)}`;
const p1 = { account_name: accountName, agent_timezone: timezone };
const accountId = await rpc(adminToken, "create_account", p1);
const invite = { target_account: accountId, agent_timezone: timezone };

await rpc(adminToken, "invite_account_member", {
  ...invite,
  member_email: "agente@cofar.test",
  make_agent: true
});
await rpc(adminToken, "invite_account_member", {
  ...invite,
  member_email: "solicitante@cofar.test",
  make_agent: false
});

const requesterToken = await signIn("solicitante@cofar.test");
const agentToken = await signIn("agente@cofar.test");
const ruleQuery = `ticket_category_rules?account_id=eq.${accountId}&select=category_id,term,weight`;
const rules = await select(requesterToken, ruleQuery);
const created = [];

for (const draft of drafts) {
  const suggestion = classifyTicket(draft, rules);
  const evidence = {
    terms: suggestion.terms,
    confidence: suggestion.confidence
  };
  const base = { target_account: accountId, ticket_title: draft.title };
  const body = {
    ticket_description: draft.description,
    category: suggestion.categoryId
  };
  const meta = { source: "auto", confidence: suggestion.confidence, evidence };
  const ticket = await rpc(requesterToken, "create_ticket", {
    ...base,
    ...body,
    ...meta
  });

  created.push({ ticketId: ticket.ticket_id, suggestion });
}

await rpc(agentToken, "claim_ticket", { ticket: created[0].ticketId });
await rpc(agentToken, "set_ticket_status", {
  ticket: created[0].ticketId,
  next_status: "in_progress"
});
await rpc(agentToken, "claim_ticket", { ticket: created[1].ticketId });
await rpc(agentToken, "set_ticket_status", {
  ticket: created[1].ticketId,
  next_status: "resolved"
});

const classified = created.filter(item => {
  return item.suggestion.categoryId;
}).length;

console.log(`Cuenta: ${accountName} (${accountId})`);
console.log(
  `Usuarios: admin@cofar.test / agente@cofar.test / solicitante@cofar.test`
);
console.log(`Contraseña: ${password}`);
console.log(
  `Tickets creados: ${created.length}, clasificados por reglas: ${classified}`
);
console.log(`Identificadores: ${adminId}, ${agentId}, ${requesterId}`);
