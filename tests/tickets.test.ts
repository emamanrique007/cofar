import { describe, expect, test, vi } from "vitest";

import { roleLabel } from "../apps/next/src/components/global/AppNav/AppNav.helpers";
import { nextStatuses } from "../apps/next/src/utils/ticket.view.utils";
import { statusActionLabel } from "../apps/next/src/utils/ticket.view.utils";
import { processTicketQueue } from "../apps/next/src/utils/tickets.utils";
import { classifyTicket, getSlaState } from "../packages/utils/src/tickets";

const rules = [
  { category_id: "accesos", term: "contraseña", weight: 5 },
  { category_id: "accesos", term: "bloqueado", weight: 4 },
  { category_id: "accesos", term: "vpn", weight: 5 },
  { category_id: "equipos", term: "impresora", weight: 5 },
  { category_id: "equipos", term: "no enciende", weight: 6 },
  { category_id: "software", term: "licencia", weight: 4 },
  { category_id: "software", term: "office", weight: 5 },
  { category_id: "rrhh", term: "licencia medica", weight: 7 },
  { category_id: "red", term: "internet", weight: 5 }
];

describe("classifyTicket", () => {
  test("classifies from the words of the request, ignoring accents", () => {
    const draft = {
      title: "No puedo entrar",
      description: "Mi contrasena vencio y el usuario quedo bloqueado"
    };
    const result = classifyTicket(draft, rules);

    expect(result.categoryId).toBe("accesos");
    expect(result.terms).toContain("contraseña");
    expect(result.confidence).toBeGreaterThan(0.55);
  });

  test("evidence in the title weighs double", () => {
    const inTitle = { title: "La impresora no anda", description: "Hola" };
    const inBody = { title: "Hola", description: "La impresora no anda" };
    const first = classifyTicket(inTitle, rules);
    const second = classifyTicket(inBody, rules);

    expect(first.scores[0]?.score).toBe(10);
    expect(second.scores[0]?.score).toBe(5);
  });

  test("a longer term wins over the word it contains", () => {
    const draft = {
      title: "Licencia medica",
      description: "Adjunto el certificado de mi licencia medica"
    };
    const result = classifyTicket(draft, rules);

    expect(result.categoryId).toBe("rrhh");
  });

  test("leaves a tie unclassified instead of guessing", () => {
    const draft = {
      title: "Consulta",
      description: "Necesito office y tambien internet"
    };
    const result = classifyTicket(draft, rules);

    expect(result.categoryId).toBeNull();
    expect(result.scores).toHaveLength(2);
  });

  test("leaves weak evidence unclassified", () => {
    const draft = {
      title: "Consulta general",
      description: "Queria saber como sigue mi pedido"
    };
    const result = classifyTicket(draft, rules);

    expect(result.categoryId).toBeNull();
    expect(result.confidence).toBe(0);
  });
});

describe("getSlaState", () => {
  const startAt = "2026-09-17T12:00:00Z";

  test("an answer before the deadline is met, after it is breached", () => {
    const dueAt = "2026-09-17T13:00:00Z";
    const now = Date.parse("2026-09-17T14:00:00Z");
    const early = { startAt, dueAt, doneAt: "2026-09-17T12:30:00Z", now };
    const late = { startAt, dueAt, doneAt: "2026-09-17T13:30:00Z", now };

    expect(getSlaState(early)).toBe("met");
    expect(getSlaState(late)).toBe("breached");
  });

  test("an open ticket warns before it expires", () => {
    const dueAt = "2026-09-17T13:00:00Z";
    const fresh = Date.parse("2026-09-17T12:10:00Z");
    const almost = Date.parse("2026-09-17T12:55:00Z");
    const over = Date.parse("2026-09-17T13:01:00Z");

    expect(getSlaState({ startAt, dueAt, doneAt: null, now: fresh })).toBe(
      "on_track"
    );
    expect(getSlaState({ startAt, dueAt, doneAt: null, now: almost })).toBe(
      "due_soon"
    );
    expect(getSlaState({ startAt, dueAt, doneAt: null, now: over })).toBe(
      "breached"
    );
  });
});

describe("ticket transitions", () => {
  test("offer only the moves the database accepts", () => {
    expect(nextStatuses("new", true, false)).toEqual([]);
    expect(nextStatuses("assigned", true, false)).toEqual([
      "in_progress",
      "resolved"
    ]);
    expect(nextStatuses("in_progress", true, false)).toEqual(["resolved"]);
    expect(nextStatuses("closed", true, false)).toEqual([]);
  });

  test("a requester only confirms or reopens a resolved ticket", () => {
    expect(nextStatuses("assigned", false, true)).toEqual([]);
    expect(nextStatuses("resolved", false, true)).toEqual([
      "closed",
      "in_progress"
    ]);
    expect(nextStatuses("resolved", false, false)).toEqual([]);
  });

  test("reopening is named after the move, not the target state", () => {
    expect(statusActionLabel("resolved", "in_progress")).toBe("Reabrir");
    expect(statusActionLabel("assigned", "in_progress")).toBe(
      "Empezar a trabajar"
    );
  });
});

describe("roleLabel", () => {
  test("names each profile by what that person can actually do", () => {
    expect(roleLabel("owner", true)).toBe("Administrador · Agente de soporte");
    expect(roleLabel("owner", false)).toBe("Administrador");
    expect(roleLabel("member", true)).toBe("Agente de soporte");
    expect(roleLabel("member", false)).toBe("Solicitante");
  });
});

describe("processTicketQueue", () => {
  const ticket = (id: string, category: string | null) => {
    return { id, account_id: "account-1", category_id: category };
  };

  const sweep = { first_response: 2, resolution: 1 };

  test("assigns what it can and reports the sweep", async () => {
    const client = {
      pending: vi
        .fn()
        .mockResolvedValue([ticket("t1", "c1"), ticket("t2", "c1")]),
      assign: vi.fn().mockResolvedValue("agent-1"),
      sweep: vi.fn().mockResolvedValue(sweep)
    };
    const result = await processTicketQueue(client);

    expect(result.assigned).toBe(2);
    expect(result.unroutable).toBe(0);
    expect(result.breached_first_response).toBe(2);
    expect(result.breached_resolution).toBe(1);
  });

  test("stops asking for a route that has nobody available", async () => {
    const pending = [
      ticket("t1", "c1"),
      ticket("t2", "c1"),
      ticket("t3", "c2")
    ];
    const client = {
      pending: vi.fn().mockResolvedValue(pending),
      assign: vi.fn().mockResolvedValueOnce(null).mockResolvedValue("agent-1"),
      sweep: vi.fn().mockResolvedValue({ first_response: 0, resolution: 0 })
    };
    const result = await processTicketQueue(client);

    expect(client.assign).toHaveBeenCalledTimes(2);
    expect(result.assigned).toBe(1);
    expect(result.unroutable).toBe(2);
  });
});
