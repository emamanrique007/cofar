import { cleanup, render as rtlRender } from "@testing-library/react";
import { renderHook as rtlRenderHook } from "@testing-library/react";
import type { ReactElement } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { afterEach } from "vitest";

import type { WrapperProps } from "./components.setup.types";

afterEach(() => {
  cleanup();
});

const Wrapper = ({ children }: WrapperProps) => {
  const form = useForm();

  return <FormProvider {...form}>{children}</FormProvider>;
};

export const render = (ui: ReactElement) => {
  return rtlRender(ui, { wrapper: Wrapper });
};

export const renderHook: typeof rtlRenderHook = (hook, options = {}) => {
  return rtlRenderHook(hook, { wrapper: Wrapper, ...options });
};
