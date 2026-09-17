import { accountsRouter } from "./accounts.router";
import { agentsRouter } from "./agents.router";
import { jobsRouter } from "./jobs.router";
import { ticketsRouter } from "./tickets.router";
import { router, publicProcedure } from "./trpc";

export const appRouter = router({
  health: publicProcedure.query(() => {
    return { status: "ok" as const };
  }),
  accounts: accountsRouter,
  jobs: jobsRouter,
  tickets: ticketsRouter,
  agents: agentsRouter
});
