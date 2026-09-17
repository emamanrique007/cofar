"use client";

import { assignmentOptions, orderOptions } from "./TicketFilters.helpers";
import { priorityOptions, statusOptions } from "./TicketFilters.helpers";
import type { QueueFilters, TicketFiltersProps } from "./TicketFilters.types";

export const TicketFilters = (props: TicketFiltersProps) => {
  const { value, categories, onChange } = props;

  const update = (patch: Partial<QueueFilters>) => {
    return onChange({ ...value, ...patch });
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="text-sm">
        Buscar
        <input
          className="mt-1"
          type="search"
          value={value.search}
          placeholder="impresora, vpn, factura…"
          onChange={event => {
            return update({ search: event.target.value });
          }}
        />
      </label>
      <label className="text-sm">
        Estado
        <select
          className="mt-1"
          value={value.status}
          onChange={event => {
            return update({
              status: event.target.value as QueueFilters["status"]
            });
          }}
        >
          <option value="">Todos</option>
          {statusOptions.map(option => {
            return (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            );
          })}
        </select>
      </label>
      <label className="text-sm">
        Prioridad
        <select
          className="mt-1"
          value={value.priority}
          onChange={event => {
            const priority = event.target.value as QueueFilters["priority"];

            return update({ priority });
          }}
        >
          <option value="">Todas</option>
          {priorityOptions.map(option => {
            return (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            );
          })}
        </select>
      </label>
      <label className="text-sm">
        Categoría
        <select
          className="mt-1"
          value={value.categoryId}
          onChange={event => {
            return update({ categoryId: event.target.value });
          }}
        >
          <option value="">Todas</option>
          {categories.map(category => {
            return (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            );
          })}
        </select>
      </label>
      <label className="text-sm">
        Asignación
        <select
          className="mt-1"
          value={value.assignment}
          onChange={event => {
            const assignment = event.target.value as QueueFilters["assignment"];

            return update({ assignment });
          }}
        >
          {assignmentOptions.map(option => {
            return (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            );
          })}
        </select>
      </label>
      <label className="text-sm">
        Orden
        <select
          className="mt-1"
          value={value.order}
          onChange={event => {
            const order = event.target.value as QueueFilters["order"];

            return update({ order });
          }}
        >
          {orderOptions.map(option => {
            return (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            );
          })}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          className="w-auto"
          type="checkbox"
          checked={value.overdue}
          onChange={event => {
            return update({ overdue: event.target.checked });
          }}
        />
        Solo vencidos
      </label>
    </div>
  );
};
