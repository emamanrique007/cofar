import { api, HttpResponse } from "@/utils/http.utils";
import { isCronAuthorized } from "@/utils/secrets.utils";
import { createTicketWorkerClient } from "@/utils/tickets.server.utils";
import { processTicketQueue } from "@/utils/tickets.utils";
import { vCron } from "@/validations/cron.validations";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = (request: Request) => {
  return api(request)
    .input(vCron.tickets())
    .handle(async inputs => {
      const { authorization } = inputs.headers;
      const secret = process.env.CRON_AUTH_SECRET;

      if (!isCronAuthorized(authorization, secret)) {
        return HttpResponse.unauthorized();
      }

      const data = await processTicketQueue(createTicketWorkerClient());

      return HttpResponse.ok({ data });
    })
    .output(vCron.ticketsResult());
};
