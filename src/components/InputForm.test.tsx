import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InputForm } from "./InputForm";

const noop = () => undefined;

function renderForm() {
  const view = render(
    <InputForm
      onAnalyzeStart={noop}
      onAnalyzeComplete={noop}
      onAnalyzeError={noop}
      loading={false}
    />
  );
  const form = view.container.querySelector("form.input-form");
  if (!form) throw new Error("form not found");
  return { ...view, form: form as HTMLFormElement };
}

describe("InputForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders ZIP and GitHub input tabs", () => {
    const { form } = renderForm();
    expect(within(form).getByRole("tab", { name: /upload zip/i })).toBeInTheDocument();
    expect(within(form).getByRole("tab", { name: /public github url/i })).toBeInTheDocument();
  });

  it("shows validation error when submitting empty ZIP", async () => {
    const user = userEvent.setup();
    const { form } = renderForm();
    await user.click(within(form).getByRole("button", { name: /analyze repository/i }));
    expect(await within(form).findByRole("alert")).toHaveTextContent(/zip/i);
  });

  it("switches to GitHub tab and validates URL", async () => {
    const user = userEvent.setup();
    const { form } = renderForm();
    await user.click(within(form).getByRole("tab", { name: /public github url/i }));
    await user.click(within(form).getByRole("button", { name: /analyze repository/i }));
    expect(await within(form).findByRole("alert")).toHaveTextContent(/github/i);
  });
});
