"use client";

import { buildCards, buildCompliance } from "./TicketMetrics.helpers";
import { priorityLabel, statusLabel } from "./TicketMetrics.helpers";
import type { TicketMetricsProps } from "./TicketMetrics.types";
import { trpc } from "@/config/trpc.config";

export const TicketMetrics = ({ accountId }: TicketMetricsProps) => {
  const options = { refetchInterval: 30000 };
  const metrics = trpc.tickets.metrics.useQuery({ accountId }, options);

  if (metrics.isLoading) {
    return <p role="status">Calculando métricas…</p>;
  }

  if (metrics.error || !metrics.data) {
    return (
      <p role="alert" className="alert-error">
        {metrics.error?.message ?? "No hay métricas disponibles"}
      </p>
    );
  }

  const cards = buildCards(metrics.data);
  const compliance = buildCompliance(metrics.data);
  const byStatus = Object.entries(metrics.data.by_status);
  const byPriority = Object.entries(metrics.data.by_priority);
  const byCategory = Object.entries(metrics.data.by_category);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(card => {
          return (
            <div key={card.label} className="card">
              <p className="text-sm text-muted">{card.label}</p>
              <p className="text-3xl font-semibold">{card.value}</p>
              <p className="text-sm text-muted">{card.hint}</p>
            </div>
          );
        })}
      </section>
      <section className="card">
        <h2 className="mb-4 text-xl font-semibold">Cumplimiento de SLA</h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted">Primera respuesta a tiempo</dt>
            <dd className="text-2xl font-semibold">{compliance.first}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Resoluciones a tiempo</dt>
            <dd className="text-2xl font-semibold">{compliance.resolved}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">
              Categorías automáticas corregidas
            </dt>
            <dd className="text-2xl font-semibold">{compliance.corrected}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-muted">
          {metrics.data.auto_categorized} tickets fueron clasificados por reglas
          y {metrics.data.agent_corrected} necesitaron corrección de un agente.
        </p>
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">Por estado</h2>
          <ul className="space-y-1 text-sm">
            {byStatus.map(entry => {
              return (
                <li key={entry[0]} className="flex justify-between gap-4">
                  <span>{statusLabel(entry[0])}</span>
                  <span className="font-medium">{entry[1]}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">Abiertos por prioridad</h2>
          <ul className="space-y-1 text-sm">
            {byPriority.map(entry => {
              return (
                <li key={entry[0]} className="flex justify-between gap-4">
                  <span>{priorityLabel(entry[0])}</span>
                  <span className="font-medium">{entry[1]}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">Por categoría</h2>
          <ul className="space-y-1 text-sm">
            {byCategory.map(entry => {
              return (
                <li key={entry[0]} className="flex justify-between gap-4">
                  <span>{entry[0]}</span>
                  <span className="font-medium">{entry[1]}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
};
