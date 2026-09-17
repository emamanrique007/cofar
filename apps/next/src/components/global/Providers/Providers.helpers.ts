import { QueryClient } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";

import { trpc } from "@/config/trpc.config";

const permanent = ["NOT_FOUND", "FORBIDDEN", "UNAUTHORIZED", "BAD_REQUEST"];

// A denied or missing resource is an answer, not a hiccup: retrying it three
// times only makes the person wait before reading what happened.
const shouldRetry = (failureCount: number, error: unknown) => {
  const shape = error as { data?: { code?: string } } | null;
  const code = shape?.data?.code ?? "";

  if (permanent.includes(code)) {
    return false;
  }

  return failureCount < 2;
};

export const createQueryClient = () => {
  const queries = { staleTime: 30_000, retry: shouldRetry };

  return new QueryClient({ defaultOptions: { queries } });
};

export const createTrpcClient = () => {
  const links = [httpBatchLink({ url: "/api/trpc" })];

  return trpc.createClient({ links });
};
