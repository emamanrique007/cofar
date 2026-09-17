import { QueryClient } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";

import { trpc } from "@/config/trpc.config";

export const createQueryClient = () => {
  const queries = { staleTime: 30_000 };

  return new QueryClient({ defaultOptions: { queries } });
};

export const createTrpcClient = () => {
  const links = [httpBatchLink({ url: "/api/trpc" })];

  return trpc.createClient({ links });
};
