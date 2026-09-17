import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";

import { POST } from "@/app/api/cron/jobs/route";
import { api, HttpResponse } from "@/utils/http.utils";
import { createQueueClient } from "@/utils/queue.server.utils";
import { processJobs } from "@/utils/queue.utils";
import { vCommon } from "@/validations/common.validations";

vi.mock("server-only", () => {
  return {};
});
vi.mock("@/utils/queue.server.utils", () => {
  return { createQueueClient: vi.fn() };
});
vi.mock("@/utils/queue.utils", () => {
  return { processJobs: vi.fn() };
});

const secret = "s".repeat(32);
const url = "http://localhost:3005/api/cron/jobs";
const result = { read: 1, completed: 1, failed: 0, stale: 0 };

const request = (body?: string, token = secret) => {
  const headers = { authorization: `Bearer ${token}` };

  return new Request(url, { method: "POST", headers, body });
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CRON_AUTH_SECRET", secret);
  vi.mocked(processJobs).mockResolvedValue(result);
});

afterEach(() => {
  return vi.unstubAllEnvs();
});

test("cron rejects unauthorized calls before creating the queue client", async () => {
  const requests = [new Request(url, { method: "POST" }), request("{}", "bad")];

  for (const req of requests) {
    const response = await POST(req);

    expect(response.status).toBe(401);
  }

  expect(createQueueClient).not.toHaveBeenCalled();
  expect(processJobs).not.toHaveBeenCalled();
});

test("cron rejects malformed JSON and invalid bodies before consuming jobs", async () => {
  const cases = [
    { body: "{", status: 400 },
    { body: "null", status: 422 },
    { body: "[]", status: 422 },
    { body: '{"unexpected":"private-value"}', status: 422 }
  ];

  for (const item of cases) {
    const response = await POST(request(item.body));

    expect(response.status).toBe(item.status);
    expect(await response.text()).not.toContain("private-value");
  }

  expect(createQueueClient).not.toHaveBeenCalled();
  expect(processJobs).not.toHaveBeenCalled();
});

test("cron accepts empty and object bodies and returns the validated envelope", async () => {
  for (const body of [undefined, "{}"]) {
    const response = await POST(request(body));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: result });
  }

  expect(processJobs).toHaveBeenCalledTimes(2);
});

test("cron hides worker errors and rejects invalid worker output", async () => {
  vi.mocked(processJobs).mockRejectedValueOnce(new Error("private-db-detail"));

  const failure = await POST(request());

  expect(failure.status).toBe(500);
  expect(await failure.text()).not.toContain("private-db-detail");
  vi.mocked(processJobs).mockResolvedValueOnce({ ...result, completed: -1 });

  const invalid = await POST(request());

  expect(invalid.status).toBe(500);
});

test("HTTP parsing applies schemas to headers, query, body and route params", async () => {
  const headers = z.object({ "x-test": z.string() });
  const searchParams = z.object({ limit: z.coerce.number().int() });
  const body = z.object({ name: z.string().trim() });
  const params = z.object({ id: z.uuid() });
  const schema = vCommon.inputs({ headers, searchParams, body, params });
  const reqHeaders = { "x-test": "header-value", ignored: "hidden" };
  const options = { headers: reqHeaders };
  const req = new Request(`${url}?limit=2&ignored=hidden`, options);
  const raw = { name: " test ", ignored: "hidden" };
  const id = "00000000-0000-4000-8000-000000000001";
  const response = await api(req, raw, { id })
    .input(schema)
    .handle(inputs => {
      return HttpResponse.ok({ data: inputs });
    }).response;

  expect(await response.json()).toEqual({
    data: {
      headers: { "x-test": "header-value" },
      searchParams: { limit: 2 },
      body: { name: "test" },
      params: { id }
    }
  });
});
