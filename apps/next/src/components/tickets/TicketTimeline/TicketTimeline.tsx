"use client";

import { ticketEventLabels } from "@cofar/utils";

import { describeEvent } from "./TicketTimeline.helpers";
import type { TicketTimelineProps } from "./TicketTimeline.types";
import { formatDateTime } from "@/utils/format.utils";

export const TicketTimeline = (props: TicketTimelineProps) => {
  const { events, assigneeName } = props;

  if (!events.length) {
    return <p className="text-muted">Todavía no hay movimientos.</p>;
  }

  return (
    <ol className="space-y-4">
      {events.map(event => {
        const actor = event.actor?.name || event.actor?.email || "El sistema";

        return (
          <li key={event.id} className="border-l-2 border-line pl-4">
            <p className="text-sm font-medium">
              {ticketEventLabels[event.type]}
            </p>
            <p className="text-sm text-muted">
              {describeEvent(event, assigneeName)}
            </p>
            <p className="text-xs text-muted">
              {formatDateTime(event.created_at)} · {actor}
            </p>
          </li>
        );
      })}
    </ol>
  );
};
