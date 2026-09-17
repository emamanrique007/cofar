import { expect, test, vi } from "vitest";

import { appRouter } from "../apps/next/src/trpc";
import type { TRPCContext } from "../apps/next/src/types/trpc.types";
import { processJobs } from "../apps/next/src/utils/queue.utils";
import { isCronAuthorized } from "../apps/next/src/utils/secrets.utils";
import { buildJobMessage } from "../packages/builders/src/index";

const message = {
  msg_id: 1,
  read_ct: 1,
  message: buildJobMessage("00000000-0000-4000-8000-000000000001")
};

test("cron rejects missing, short and incorrect secrets", () => {
  const secret = "s".repeat(32);

  expect(isCronAuthorized(null, secret)).toBe(false);
  expect(isCronAuthorized("Bearer undefined", undefined)).toBe(false);
  expect(isCronAuthorized("Bearer short", "short")).toBe(false);
  expect(isCronAuthorized(`Bearer ${"x".repeat(32)}`, secret)).toBe(false);
  expect(isCronAuthorized(`Bearer ${secret}`, secret)).toBe(true);
});

test("valid work is completed and stale receipts are not counted as completed", async () => {
  const client = {
    read: vi.fn().mockResolvedValue([message]),
    complete: vi.fn().mockResolvedValue(true),
    fail: vi.fn()
  };

  expect(await processJobs(client)).toEqual({
    read: 1,
    completed: 1,
    failed: 0,
    stale: 0
  });
  expect(client.complete).toHaveBeenCalledWith(1, 1);
  expect(client.fail).not.toHaveBeenCalled();
  client.complete.mockResolvedValue(false);
  expect((await processJobs(client)).stale).toBe(1);
});

test("poison payload enters retry path without running the handler", async () => {
  const client = {
    read: vi
      .fn()
      .mockResolvedValue([{ ...message, message: { job_id: "invalid" } }]),
    complete: vi.fn(),
    fail: vi.fn().mockResolvedValue(true)
  };

  expect((await processJobs(client)).failed).toBe(1);
  expect(client.complete).not.toHaveBeenCalled();
  expect(client.fail).toHaveBeenCalledWith(1, 1, expect.any(String));
});

test("processing errors retry; failure to persist retry is propagated", async () => {
  const client = {
    read: vi.fn().mockResolvedValue([message]),
    complete: vi.fn().mockRejectedValue(new Error("db")),
    fail: vi.fn().mockResolvedValue(true)
  };

  expect((await processJobs(client)).failed).toBe(1);
  client.fail.mockRejectedValue(new Error("retry unavailable"));
  await expect(processJobs(client)).rejects.toThrow("retry unavailable");
});

test("tRPC rejects unauthenticated users before any database access", async () => {
  const supabase = {} as TRPCContext["supabase"];
  const caller = appRouter.createCaller({ supabase, user: null });

  await expect(caller.accounts.list()).rejects.toMatchObject({
    code: "UNAUTHORIZED"
  });
  await expect(
    caller.jobs.list({ accountId: "00000000-0000-4000-8000-000000000001" })
  ).rejects.toMatchObject({
    code: "UNAUTHORIZED"
  });
});
