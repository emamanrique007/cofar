"use client";

import { Constants } from "@cofar/types";
import { ticketAvailabilityLabels, weekdayLabels } from "@cofar/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

import { shiftDefaults, shiftSchema } from "./AgentShift.helpers";
import { toShiftValues } from "./AgentShift.helpers";
import type { AgentShiftProps, ShiftInput } from "./AgentShift.types";
import type { ShiftOutput } from "./AgentShift.types";
import { FormInput } from "@/components/form/FormInput/FormInput";
import { FormSelect } from "@/components/form/FormSelect/FormSelect";
import { trpc } from "@/config/trpc.config";
import { Form } from "@/ui/form";
import { logFormErrors } from "@/utils/form.utils";

const availabilityOptions = Constants.public.Enums.ticket_availability.map(
  value => {
    return { value, label: ticketAvailabilityLabels[value] };
  }
);

export const AgentShift = ({ accountId }: AgentShiftProps) => {
  const utils = trpc.useUtils();
  const shift = trpc.agents.me.useQuery({ accountId });
  const values = shift.data ? toShiftValues(shift.data) : undefined;
  const resolver = zodResolver(shiftSchema);
  const options = { resolver, defaultValues: shiftDefaults, values };
  const form = useForm<ShiftInput, unknown, ShiftOutput>(options);

  const onSaved = async () => {
    await utils.agents.me.invalidate({ accountId });
    await utils.agents.list.invalidate({ accountId });
  };

  const update = trpc.agents.updateShift.useMutation({ onSuccess: onSaved });

  const submit: SubmitHandler<ShiftOutput> = data => {
    const p1 = { accountId, availability: data.availability };
    const p2 = { timezone: data.timezone, days: data.days };
    const p3 = { start: data.start, end: data.end };
    const p4 = { maxOpen: data.maxOpen, autoAssign: data.autoAssign };

    update.mutate({ ...p1, ...p2, ...p3, ...p4 });
  };

  if (!shift.data) {
    return null;
  }

  return (
    <section className="card">
      <h2 className="mb-1 text-xl font-semibold">Mi jornada</h2>
      <p className="mb-4 text-sm text-muted">
        La asignación automática solo te elige dentro de tu horario, y la suma
        de las jornadas del equipo es el reloj con el que se mide el SLA.
      </p>
      <Form {...form}>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(submit, logFormErrors)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormSelect
              control={form.control}
              label="Disponibilidad"
              name="availability"
              options={availabilityOptions}
            />
            <FormInput
              control={form.control}
              label="Huso horario"
              name="timezone"
              placeholder="America/Argentina/Tucuman"
            />
            <FormInput
              control={form.control}
              label="Desde"
              name="start"
              type="time"
            />
            <FormInput
              control={form.control}
              label="Hasta"
              name="end"
              type="time"
            />
            <FormInput
              control={form.control}
              label="Tickets abiertos como máximo"
              name="maxOpen"
              type="number"
              min={1}
              max={100}
            />
          </div>
          <fieldset>
            <legend className="text-sm">Días de trabajo</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {weekdayLabels.map((label, index) => {
                return (
                  <label
                    key={label}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      className="w-auto"
                      type="checkbox"
                      value={index}
                      {...form.register("days")}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input
              className="w-auto"
              type="checkbox"
              {...form.register("autoAssign")}
            />
            Recibir tickets por asignación automática
          </label>
          {update.error ? (
            <p role="alert" className="alert-error">
              {update.error.message}
            </p>
          ) : null}
          {update.isSuccess ? (
            <p role="status" className="text-sm text-success">
              Jornada guardada.
            </p>
          ) : null}
          <button disabled={update.isPending} type="submit">
            Guardar jornada
          </button>
        </form>
      </Form>
    </section>
  );
};
