import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dashboard } from "./Dashboard";
import { trpc } from "@/config/trpc.config";

const replace = vi.fn();
const refresh = vi.fn();
const clear = vi.fn();
const signOut = vi.fn();
const createMutate = vi.fn();
const enqueueMutate = vi.fn();

vi.mock("next/navigation", () => {
  return {
    useRouter: () => {
      return { replace, refresh };
    }
  };
});

vi.mock("@tanstack/react-query", () => {
  return {
    useQueryClient: () => {
      return { clear };
    }
  };
});

vi.mock("@/utils/supabase/supabase.client", () => {
  return {
    createBrowserClient: () => {
      return { auth: { signOut } };
    }
  };
});

vi.mock("@/config/trpc.config", () => {
  return {
    trpc: {
      accounts: {
        list: { useQuery: vi.fn() },
        create: { useMutation: vi.fn() }
      },
      jobs: {
        list: { useQuery: vi.fn() },
        enqueue: { useMutation: vi.fn() }
      },
      useUtils: vi.fn()
    }
  };
});

const idleQuery = { data: undefined, isLoading: false, error: null };
const idleMutation = { mutate: vi.fn(), isPending: false, error: null };

describe("Dashboard", () => {
  beforeEach(() => {
    createMutate.mockReset();
    enqueueMutate.mockReset();
    signOut.mockReset();
    signOut.mockResolvedValue({ error: null });
    vi.mocked(trpc.accounts.list.useQuery).mockReturnValue({
      ...idleQuery,
      data: []
    } as never);
    vi.mocked(trpc.jobs.list.useQuery).mockReturnValue({
      ...idleQuery,
      data: []
    } as never);
    vi.mocked(trpc.accounts.create.useMutation).mockReturnValue({
      ...idleMutation,
      mutate: createMutate
    } as never);
    vi.mocked(trpc.jobs.enqueue.useMutation).mockReturnValue({
      ...idleMutation,
      mutate: enqueueMutate
    } as never);
    vi.mocked(trpc.useUtils).mockReturnValue({
      accounts: { list: { invalidate: vi.fn() } },
      jobs: { list: { invalidate: vi.fn() } }
    } as never);
  });

  it("renders the workspace heading, email and account form", () => {
    render(<Dashboard email="eva@cofar.test" />);

    expect(
      screen.getByRole("heading", { name: "Mi espacio de trabajo" })
    ).toBeTruthy();
    expect(screen.getByText("eva@cofar.test")).toBeTruthy();
    expect(screen.getByLabelText("Nueva cuenta")).toBeTruthy();
    expect(screen.queryByLabelText("Mensaje")).toBeNull();
  });

  it("creates an account from the form", async () => {
    const user = userEvent.setup();

    render(<Dashboard email="eva@cofar.test" />);
    await user.type(screen.getByLabelText("Nueva cuenta"), "Cofar");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(createMutate).toHaveBeenCalledWith({ name: "Cofar" });
  });

  it("lists queued jobs for the active account", () => {
    const account = { id: "acc-1", name: "Principal" };
    const job = { id: "job-1", body: "Trabajo verificado", status: "queued" };

    vi.mocked(trpc.accounts.list.useQuery).mockReturnValue({
      ...idleQuery,
      data: [account]
    } as never);
    vi.mocked(trpc.jobs.list.useQuery).mockReturnValue({
      ...idleQuery,
      data: [job]
    } as never);
    render(<Dashboard email="eva@cofar.test" />);

    expect(screen.getByText("Trabajo verificado")).toBeTruthy();
    expect(screen.getByText("En cola")).toBeTruthy();
  });
});
