import { accountsRouter } from "./accounts.router";
import { jobsRouter } from "./jobs.router";
import { router, publicProcedure } from "./trpc";

export const appRouter = router({
  health: publicProcedure.query(() => {
    return { status: "ok" as const };
  }),
  accounts: accountsRouter,
  jobs: jobsRouter
});
