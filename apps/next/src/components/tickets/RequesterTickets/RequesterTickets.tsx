"use client";

import type { RequesterTicketsProps } from "./RequesterTickets.types";
import { TicketForm } from "@/components/tickets/TicketForm/TicketForm";
import { TicketList } from "@/components/tickets/TicketList/TicketList";
import { trpc } from "@/config/trpc.config";

export const RequesterTickets = ({ accountId }: RequesterTicketsProps) => {
  const input = { accountId, scope: "requester" as const };
  const options = { refetchInterval: 15000 };
  const tickets = trpc.tickets.list.useQuery(input, options);
  const empty = "Todavía no hiciste ninguna solicitud.";

  return (
    <div className="space-y-6">
      <TicketForm accountId={accountId} />
      <section className="card">
        <h2 className="mb-4 text-xl font-semibold">Mis solicitudes</h2>
        {tickets.isLoading ? <p role="status">Cargando solicitudes…</p> : null}
        {tickets.error ? (
          <p role="alert" className="alert-error">
            {tickets.error.message}
          </p>
        ) : null}
        <TicketList tickets={tickets.data ?? []} emptyMessage={empty} />
      </section>
    </div>
  );
};
