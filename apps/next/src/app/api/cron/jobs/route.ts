import { api, HttpResponse } from "@/utils/http.utils";
import { createQueueClient } from "@/utils/queue.server.utils";
import { processJobs } from "@/utils/queue.utils";
import { isCronAuthorized } from "@/utils/secrets.utils";
import { vCron } from "@/validations/cron.validations";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = (request: Request) => {
  return api(request)
    .input(vCron.jobs())
    .handle(async inputs => {
      const { authorization } = inputs.headers;
      const secret = process.env.CRON_AUTH_SECRET;

      if (!isCronAuthorized(authorization, secret)) {
        return HttpResponse.unauthorized();
      }

      const data = await processJobs(createQueueClient());

      return HttpResponse.ok({ data });
    })
    .output(vCron.result());
};
