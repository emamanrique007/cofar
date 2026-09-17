import type { z } from "zod";

export interface ApiInputs {
  headers: Record<string, string>;
  searchParams: Record<string, string>;
  body: unknown;
  params: Record<string, string | string[]>;
}

export interface ResponseBodySuccess<T = unknown> {
  data: T;
}

export interface ResponseBodyError {
  error: string;
  details?: unknown;
}

export type ApiInputSchemas = Partial<Record<keyof ApiInputs, z.ZodType>>;
export type ApiHandler<T> = (inputs: T) => Response | Promise<Response>;
