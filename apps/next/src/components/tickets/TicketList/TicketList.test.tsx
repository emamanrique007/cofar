import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TicketList } from "./TicketList";
import type { TicketListItem } from "@/types/ticket.types";

const person = { id: "user-1", name: "Eva Díaz", email: "eva@cofar.test" };
const category = {
  id: "cat-1",
  name: "Accesos y contraseñas",
  slug: "accesos"
};

const buildTicket = (overrides: Partial<TicketListItem> = {}) => {
  const base = { id: "ticket-1", number: 12, title: "No puedo ingresar" };
  const state = { status: "new" as const, priority: "high" as const };
  const dates = { created_at: "2026-09-17T12:00:00Z" };
  const sla = { first_response_due_at: "2026-09-17T13:00:00Z" };
  const sla2 = { resolution_due_at: "2026-09-17T20:00:00Z" };
  const marks = { first_responded_at: null, resolved_at: null };
  const breaches = { first_response_breached_at: null };
  const breaches2 = { resolution_breached_at: null };
  const refs = { category_id: "cat-1", category_source: "auto" as const };
  const people = { requester_id: "user-1", assignee_id: null };
  const joins = { category, requester: person, assignee: null };
  const ticket = { ...base, ...state, ...dates, ...sla, ...sla2, ...marks };
  const rest = { ...breaches, ...breaches2, ...refs, ...people, ...joins };

  return { ...ticket, ...rest, ...overrides } as TicketListItem;
};

describe("TicketList", () => {
  it("shows the empty message when there is nothing to list", () => {
    render(<TicketList tickets={[]} emptyMessage="Sin solicitudes" />);

    expect(screen.getByText("Sin solicitudes")).toBeTruthy();
  });

  it("names the ticket, its category, its state and who is missing", () => {
    render(<TicketList tickets={[buildTicket()]} emptyMessage="Vacío" />);

    expect(screen.getByText("#12 · No puedo ingresar")).toBeTruthy();
    expect(screen.getByText(/Accesos y contraseñas/)).toBeTruthy();
    expect(screen.getByText(/Sin asignar/)).toBeTruthy();
    expect(screen.getByText("En cola")).toBeTruthy();
    expect(screen.getByText("Alta")).toBeTruthy();
  });

  it("only offers to take tickets that are still in the queue", async () => {
    const onClaim = vi.fn();
    const taken = buildTicket({ id: "ticket-2", status: "assigned" });
    const tickets = [buildTicket(), taken];
    const user = userEvent.setup();

    render(
      <TicketList tickets={tickets} emptyMessage="Vacío" onClaim={onClaim} />
    );

    const buttons = screen.getAllByRole("button", { name: "Tomar" });

    expect(buttons).toHaveLength(1);
    await user.click(buttons[0]!);
    expect(onClaim).toHaveBeenCalledWith("ticket-1");
  });
});
