import { Constants } from "@cofar/types";
import { z } from "zod";

const availabilities = Constants.public.Enums.ticket_availability;
const clock = /^([01]\d|2[0-3]):[0-5]\d$/;

const shiftFields = {
  timezone: z.string().trim().min(1).max(64),
  days: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7),
  start: z.string().regex(clock, "Usá el formato HH:MM"),
  end: z.string().regex(clock, "Usá el formato HH:MM"),
  maxOpen: z.coerce.number().int().min(1).max(100),
  autoAssign: z.boolean(),
  categoryIds: z.array(z.uuid()).max(100)
};

const createValidation = () => {
  return z.object({
    accountId: z.uuid(),
    name: z.string().trim().min(2, "Escribí el nombre").max(80),
    email: z.email("Ingresá un correo válido"),
    password: z.string().min(8, "Usá al menos 8 caracteres").max(72),
    asAgent: z.boolean(),
    ...shiftFields
  });
};

const createFormValidation = () => {
  return z.object({
    name: z.string().trim().min(2, "Escribí el nombre").max(80),
    email: z.email("Ingresá un correo válido"),
    password: z.string().min(8, "Usá al menos 8 caracteres").max(72),
    asAgent: z.boolean(),
    ...shiftFields
  });
};

const inviteValidation = () => {
  return z.object({
    accountId: z.uuid(),
    email: z.email("Ingresá un correo válido"),
    asAgent: z.boolean().default(false)
  });
};

const inviteFormValidation = () => {
  return z.object({
    email: z.email("Ingresá un correo válido"),
    asAgent: z.boolean().default(false)
  });
};

const membershipValidation = () => {
  return z.object({
    accountId: z.uuid(),
    userId: z.uuid(),
    enabled: z.boolean()
  });
};

const shiftValidation = () => {
  return z.object({
    accountId: z.uuid(),
    availability: z.enum(availabilities),
    timezone: z.string().trim().min(1).max(64),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    start: z.string().regex(clock, "Usá el formato HH:MM"),
    end: z.string().regex(clock, "Usá el formato HH:MM"),
    maxOpen: z.number().int().min(1).max(100),
    autoAssign: z.boolean()
  });
};

const shiftFormValidation = () => {
  return z.object({
    availability: z.enum(availabilities),
    timezone: z.string().trim().min(1, "Indicá tu huso horario").max(64),
    days: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Elegí un día"),
    start: z.string().regex(clock, "Usá el formato HH:MM"),
    end: z.string().regex(clock, "Usá el formato HH:MM"),
    maxOpen: z.coerce.number().int().min(1).max(100),
    autoAssign: z.boolean()
  });
};

export const vAgent = {
  create: createValidation,
  createForm: createFormValidation,
  invite: inviteValidation,
  inviteForm: inviteFormValidation,
  membership: membershipValidation,
  shift: shiftValidation,
  shiftForm: shiftFormValidation
};
