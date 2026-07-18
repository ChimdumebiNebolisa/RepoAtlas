import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InputForm } from "./InputForm";
import type { Report } from "@/types/report";

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
    expect(within(form).getByRole("tab", { name: /public github url/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("shows validation error when submitting empty ZIP", async () => {
    const user = userEvent.setup();
    const { form } = renderForm();
    await user.click(within(form).getByRole("tab", { name: /upload zip/i }));
    await user.click(within(form).getByRole("button", { name: /analyze uploaded zip/i }));
    expect(await within(form).findByRole("alert")).toHaveTextContent(/zip/i);
  });

  it("shows GitHub first and validates the public URL", async () => {
    const user = userEvent.setup();
    const { form } = renderForm();
    await user.click(
      within(form).getByRole("button", { name: /analyze public github repository/i })
    );
    expect(await within(form).findByRole("alert")).toHaveTextContent(/github/i);
  });

  it("names the Candidate Brief created by the bundled sample", () => {
    const { form } = renderForm();
    expect(
      within(form).getByRole("button", { name: /generate sample candidate brief/i })
    ).toBeInTheDocument();
  });

  it("completes from an inline report when persistence is unavailable", async () => {
    const user = userEvent.setup();
    const onAnalyzeComplete = vi.fn();
    const inlineReport = { report_version: "1" } as unknown as Report;
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          reportId: "11111111-1111-4111-8111-111111111111",
          report: inlineReport,
          persisted: false,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    render(
      <InputForm
        onAnalyzeStart={noop}
        onAnalyzeComplete={onAnalyzeComplete}
        onAnalyzeError={noop}
        loading={false}
      />
    );
    await user.click(screen.getByRole("button", { name: /generate sample candidate brief/i }));

    expect(onAnalyzeComplete).toHaveBeenCalledWith(inlineReport, null);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
