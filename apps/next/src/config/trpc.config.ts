"use client";

import { createTRPCReact } from "@trpc/react-query";

import type { AppRouter } from "@/types/trpc.types";

export const trpc = createTRPCReact<AppRouter>();
