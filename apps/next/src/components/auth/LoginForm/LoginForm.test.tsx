import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./LoginForm";

const login = vi.hoisted(() => {
  return vi.fn(async () => {
    return { error: "" };
  });
});

vi.mock("./LoginForm.helpers", () => {
  return { login };
});

describe("LoginForm", () => {
  beforeEach(() => {
    login.mockReset();
    login.mockResolvedValue({ error: "" });
  });

  it("renders email, password and submit controls", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText("Correo electrónico")).toBeTruthy();
    expect(screen.getByLabelText("Contraseña")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeTruthy();
  });

  it("validates fields before calling the server action", async () => {
    const user = userEvent.setup();

    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(login).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });

  it("shows the login error returned by the server action", async () => {
    const user = userEvent.setup();
    const error = "Revisá el correo y la contraseña.";

    login.mockResolvedValue({ error });
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Correo electrónico"), "a@b.test");
    await user.type(screen.getByLabelText("Contraseña"), "secret-1");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    expect((await screen.findByRole("alert")).textContent).toBe(error);
  });
});
