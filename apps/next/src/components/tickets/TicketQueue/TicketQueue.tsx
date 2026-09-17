"use client";

import { useState } from "react";

import { buildListInput } from "./TicketQueue.helpers";
import type { TicketQueueProps } from "./TicketQueue.types";
import { TicketFilters } from "@/components/tickets/TicketFilters/TicketFilters";
import { emptyFilters } from "@/components/tickets/TicketFilters/TicketFilters.helpers";
import { TicketList } from "@/components/tickets/TicketList/TicketList";
import { trpc } from "@/config/trpc.config";

export const TicketQueue = ({ accountId }: TicketQueueProps) => {
  const utils = trpc.useUtils();
  const [filters, setFilters] = useState(emptyFilters);
  const [claimingId, setClaimingId] = useState("");
  const [notice, setNotice] = useState("");
  const categories = trpc.tickets.categories.useQuery({ accountId });
  const input = buildListInput(accountId, filters);
  const tickets = trpc.tickets.list.useQuery(input, { refetchInterval: 15000 });

  const onClaimed = async (data: { claimed: boolean }) => {
    setClaimingId("");
    setNotice(data.claimed ? "" : "Otro agente ya tomó ese ticket.");
    await utils.tickets.list.invalidate();
  };

  const claim = trpc.tickets.claim.useMutation({ onSuccess: onClaimed });

  const onClaim = (ticketId: string) => {
    setNotice("");
    setClaimingId(ticketId);
    claim.mutate({ ticketId });
  };

  const empty = "No hay tickets que cumplan estos filtros.";
  const error = tickets.error ?? claim.error ?? categories.error;

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="mb-4 text-xl font-semibold">Filtros</h2>
        <TicketFilters
          value={filters}
          categories={categories.data ?? []}
          onChange={setFilters}
        />
      </section>
      <section className="card">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Cola de soporte</h2>
          <p className="text-sm text-muted">
            {tickets.data?.length ?? 0} tickets
          </p>
        </div>
        {tickets.isLoading ? <p role="status">Cargando la cola…</p> : null}
        {error ? (
          <p role="alert" className="alert-error">
            {error.message}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="alert-warn">
            {notice}
          </p>
        ) : null}
        <TicketList
          showRequester
          tickets={tickets.data ?? []}
          emptyMessage={empty}
          onClaim={onClaim}
          claimingId={claimingId}
        />
      </section>
    </div>
  );
};
