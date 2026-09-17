import { screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { FormInput } from "./FormInput";
import { render } from "@/test/components.setup";
import { Form } from "@/ui/form";

const Host = () => {
  const form = useForm({ defaultValues: { name: "" } });

  return (
    <Form {...form}>
      <FormInput control={form.control} label="Tu nombre" name="name" />
    </Form>
  );
};

describe("FormInput", () => {
  it("renders with default props", () => {
    render(<Host />);

    expect(screen.getByLabelText("Tu nombre")).toBeTruthy();
  });
});
