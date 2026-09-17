import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountPicker } from "./AccountPicker";
import { trpc } from "@/config/trpc.config";

const push = vi.fn();
const refresh = vi.fn();
const createMutate = vi.fn();

vi.mock("next/navigation", () => {
  return {
    useRouter: () => {
      return { push, refresh };
    }
  };
});

vi.mock("@/config/trpc.config", () => {
  return {
    trpc: {
      accounts: {
        create: { useMutation: vi.fn() }
      }
    }
  };
});

const owned = { id: "account-1", name: "Soporte interno", role: "owner" };
const member = { id: "account-2", name: "Otra empresa", role: "member" };
const idleMutation = { mutate: vi.fn(), isPending: false, error: null };

describe("AccountPicker", () => {
  beforeEach(() => {
    push.mockReset();
    createMutate.mockReset();
    vi.mocked(trpc.accounts.create.useMutation).mockReturnValue({
      ...idleMutation,
      mutate: createMutate
    } as never);
  });

  it("lists one box per space, with its role and which one is active", () => {
    render(<AccountPicker accounts={[owned, member]} activeId="account-2" />);

    expect(
      screen.getByRole("button", { name: /Soporte interno/ })
    ).toBeTruthy();
    expect(screen.getByText("Administrador")).toBeTruthy();
    expect(screen.getByText("Activo")).toBeTruthy();
  });

  it("enters the space that was clicked", async () => {
    const user = userEvent.setup();

    render(<AccountPicker accounts={[owned]} activeId="" />);
    await user.click(screen.getByRole("button", { name: /Soporte interno/ }));

    expect(push).toHaveBeenCalledWith("/tickets?account=account-1");
  });

  it("offers to create a space when there is none", async () => {
    const user = userEvent.setup();

    render(<AccountPicker accounts={[]} activeId="" />);

    expect(screen.getByText(/Todavía no pertenecés/)).toBeTruthy();
    await user.type(screen.getByLabelText("Nombre del espacio"), "Cofar");
    await user.click(screen.getByRole("button", { name: "Crear espacio" }));

    expect(createMutate).toHaveBeenCalledWith({ name: "Cofar" });
  });
});
