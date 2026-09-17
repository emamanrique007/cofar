"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { createQueryClient, createTrpcClient } from "./Providers.helpers";
import type { ProvidersProps } from "./Providers.types";
import { trpc } from "@/config/trpc.config";

export const Providers = ({ children }: ProvidersProps) => {
  const [queryClient] = useState(createQueryClient);
  const [client] = useState(createTrpcClient);

  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
};
