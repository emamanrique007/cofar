import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter } from "@/trpc";
import { createContext } from "@/trpc/trpc.context";

const handler = (req: Request) => {
  const endpoint = "/api/trpc";
  const router = appRouter;

  return fetchRequestHandler({ endpoint, router, createContext, req });
};

export { handler as GET, handler as POST };
