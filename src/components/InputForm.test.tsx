import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Report } from "@/types/report";

const captureAnalysisEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/productAnalytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/productAnalytics")>();
  return { ...actual, captureAnalysisEvent };
});

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
    captureAnalysisEvent.mockClear();
    window.history.replaceState({}, "", "/");
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

  it("keeps the interview walkthrough prominent and reveals other focuses on demand", async () => {
    const user = userEvent.setup();
    const { form } = renderForm();
    const disclosure = within(form)
      .getByText(/Use a different conversation focus/i)
      .closest("summary");
    const details = disclosure?.closest("details");

    expect(within(form).getByRole("radio", { name: /Interview walkthrough/i })).toBeChecked();
    expect(details).not.toHaveAttribute("open");
    expect(
      within(form).getByRole("radio", { name: /Investigate a bug/i })
    ).not.toBeVisible();

    await user.click(disclosure as HTMLElement);

    expect(details).toHaveAttribute("open");
    expect(within(form).getByRole("radio", { name: /Investigate a bug/i })).toBeVisible();
    expect(within(form).getByRole("radio", { name: /Plan a change/i })).toBeVisible();
    expect(within(form).getByRole("radio", { name: /Discuss a pull request/i })).toBeVisible();

    await user.click(within(form).getByRole("radio", { name: /Investigate a bug/i }));
    expect(within(form).getByText(/Selected: Investigate a bug/i)).toBeVisible();

    await user.click(within(form).getByRole("radio", { name: /Interview walkthrough/i }));
    expect(details).not.toHaveAttribute("open");
  });

  it("sends the selected bounded intent with the sample analysis", async () => {
    const user = userEvent.setup();
    const inlineReport = { report_version: 3 } as unknown as Report;
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

    const { form } = renderForm();
    await user.click(within(form).getByText(/Use a different conversation focus/i));
    await user.click(screen.getByRole("radio", { name: /investigate a bug/i }));
    await user.click(screen.getByRole("button", { name: /generate sample candidate brief/i }));

    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      sample: true,
      analysisIntent: "bug",
    });
  });

  it("sends the selected bounded intent with a GitHub analysis", async () => {
    const user = userEvent.setup();
    const inlineReport = { report_version: 3 } as unknown as Report;
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

    const { form } = renderForm();
    await user.click(within(form).getByText(/Use a different conversation focus/i));
    await user.click(within(form).getByRole("radio", { name: /Plan a change/i }));
    await user.type(
      within(form).getByLabelText(/Public GitHub repository URL/i),
      "https://github.com/octocat/demo"
    );
    await user.click(
      within(form).getByRole("button", { name: /Analyze public GitHub repository/i })
    );

    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      githubUrl: "https://github.com/octocat/demo",
      analysisIntent: "planned_change",
    });
    expect(captureAnalysisEvent).toHaveBeenNthCalledWith(
      1,
      "analysis_started",
      "github",
      "planned_change",
      {}
    );
    expect(captureAnalysisEvent).toHaveBeenNthCalledWith(
      2,
      "analysis_completed",
      "github",
      "planned_change",
      {}
    );
  });

  it("submits the current GitHub controls before controlled state settles", async () => {
    const inlineReport = { report_version: 3 } as unknown as Report;
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

    const { form } = renderForm();
    const githubUrlInput = within(form).getByLabelText(
      /Public GitHub repository URL/i
    ) as HTMLInputElement;
    const githubRefInput = within(form).getByLabelText(/Branch or tag/i) as HTMLInputElement;
    const setNativeValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    setNativeValue?.call(githubUrlInput, "https://github.com/octocat/demo");
    setNativeValue?.call(githubRefInput, "release/v1");
    fireEvent.submit(form);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      githubUrl: "https://github.com/octocat/demo",
      analysisIntent: "interview",
      ref: "release/v1",
    });
  });

  it("sends the selected bounded intent with a ZIP analysis", async () => {
    const user = userEvent.setup();
    const inlineReport = { report_version: 3 } as unknown as Report;
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

    const { form } = renderForm();
    await user.click(within(form).getByText(/Use a different conversation focus/i));
    await user.click(within(form).getByRole("radio", { name: /Discuss a pull request/i }));
    await user.click(within(form).getByRole("tab", { name: /Upload ZIP/i }));
    await user.upload(
      within(form).getByLabelText(/Choose repository zip file/i),
      new File(["zip"], "repository.zip", { type: "application/zip" })
    );
    await user.click(within(form).getByRole("button", { name: /Analyze uploaded ZIP/i }));

    const request = fetchMock.mock.calls[0]?.[1];
    const body = request?.body as FormData;
    expect(body.get("analysisIntent")).toBe("pull_request");
    expect(body.get("file")).toBeInstanceOf(File);
    expect(captureAnalysisEvent).toHaveBeenNthCalledWith(
      1,
      "analysis_started",
      "zip",
      "pull_request",
      {}
    );
    expect(captureAnalysisEvent).toHaveBeenNthCalledWith(
      2,
      "analysis_completed",
      "zip",
      "pull_request",
      {}
    );
  });

  it("attributes an analysis started from the interview-preparation page", async () => {
    const user = userEvent.setup();
    const inlineReport = { report_version: 3 } as unknown as Report;
    window.history.replaceState({}, "", "/?source=interview_preparation#analyze");
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          reportId: "11111111-1111-4111-8111-111111111111",
          report: inlineReport,
          persisted: false,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    renderForm();
    await user.click(screen.getByRole("button", { name: /generate sample candidate brief/i }));

    expect(captureAnalysisEvent).toHaveBeenNthCalledWith(
      1,
      "analysis_started",
      "sample",
      "interview",
      { entry_source: "interview_preparation" }
    );
    expect(captureAnalysisEvent).toHaveBeenNthCalledWith(
      2,
      "analysis_completed",
      "sample",
      "interview",
      { entry_source: "interview_preparation" }
    );
  });

  it("preserves an accepted Cycle 3 source through completion", async () => {
    const user = userEvent.setup();
    const inlineReport = { report_version: 3 } as unknown as Report;
    window.history.replaceState({}, "", "/?source=c3p1#analyze");
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          reportId: "11111111-1111-4111-8111-111111111111",
          report: inlineReport,
          persisted: false,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    renderForm();
    await user.click(screen.getByRole("button", { name: /generate sample candidate brief/i }));

    expect(captureAnalysisEvent).toHaveBeenNthCalledWith(
      1,
      "analysis_started",
      "sample",
      "interview",
      { entry_source: "c3p1" }
    );
    expect(captureAnalysisEvent).toHaveBeenNthCalledWith(
      2,
      "analysis_completed",
      "sample",
      "interview",
      { entry_source: "c3p1" }
    );
  });

  it("preserves an accepted Cycle 3 source through failure", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/?source=c3p2#analyze");
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "ANALYSIS_FAILED", message: "Try again." }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })
    );

    renderForm();
    await user.click(screen.getByRole("button", { name: /generate sample candidate brief/i }));

    expect(captureAnalysisEvent).toHaveBeenNthCalledWith(
      1,
      "analysis_started",
      "sample",
      "interview",
      { entry_source: "c3p2" }
    );
    expect(captureAnalysisEvent).toHaveBeenNthCalledWith(
      2,
      "analysis_failed",
      "sample",
      "interview",
      {
        entry_source: "c3p2",
        stage: "analysis",
        status_code: 500,
        error_code: "ANALYSIS_FAILED",
      }
    );
  });

  it("drops an unknown source before analysis events are captured", async () => {
    const user = userEvent.setup();
    const inlineReport = { report_version: 3 } as unknown as Report;
    window.history.replaceState({}, "", "/?source=private-repository-name#analyze");
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          reportId: "11111111-1111-4111-8111-111111111111",
          report: inlineReport,
          persisted: false,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    renderForm();
    await user.click(screen.getByRole("button", { name: /generate sample candidate brief/i }));

    expect(captureAnalysisEvent).toHaveBeenNthCalledWith(
      1,
      "analysis_started",
      "sample",
      "interview",
      {}
    );
    expect(captureAnalysisEvent).toHaveBeenNthCalledWith(
      2,
      "analysis_completed",
      "sample",
      "interview",
      {}
    );
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

  it("keeps report identifiers and raw server details out of client diagnostics", async () => {
    const user = userEvent.setup();
    const onAnalyzeError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reportId = "11111111-1111-4111-8111-111111111111";
    const privateMessage =
      "Failed for https://github.com/private-owner/private-repository token=private-secret";
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ reportId, persisted: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: "PRIVATE_CODE_WITH_DETAILS",
            message: privateMessage,
          }),
          { status: 503, headers: { "content-type": "application/json" } }
        )
      );

    render(
      <InputForm
        onAnalyzeStart={noop}
        onAnalyzeComplete={noop}
        onAnalyzeError={onAnalyzeError}
        loading={false}
      />
    );
    await user.click(screen.getByRole("button", { name: /generate sample candidate brief/i }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(
      JSON.stringify({
        stage: "report_load",
        errorCode: "ANALYSIS_FAILED",
        status: 503,
      })
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(
      /11111111|private-owner|private-repository|private-secret|PRIVATE_CODE_WITH_DETAILS/
    );
    expect(onAnalyzeError).toHaveBeenCalledWith(
      expect.stringContaining("Failed to load analysis report")
    );
    expect(captureAnalysisEvent).toHaveBeenLastCalledWith(
      "analysis_failed",
      "sample",
      "interview",
      {
        stage: "report_load",
        status_code: 503,
        error_code: "ANALYSIS_FAILED",
      }
    );
  });

  it("keeps raw network errors out of client diagnostics", async () => {
    const user = userEvent.setup();
    const onAnalyzeError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rawError = new Error(
      "https://github.com/private-owner/private-repository token=private-secret"
    );
    vi.spyOn(global, "fetch").mockRejectedValueOnce(rawError);

    render(
      <InputForm
        onAnalyzeStart={noop}
        onAnalyzeComplete={noop}
        onAnalyzeError={onAnalyzeError}
        loading={false}
      />
    );
    await user.click(screen.getByRole("button", { name: /generate sample candidate brief/i }));

    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(
      JSON.stringify({ stage: "network", errorCode: "NETWORK_ERROR" })
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(
      /private-owner|private-repository|private-secret/
    );
    expect(onAnalyzeError).toHaveBeenCalledWith("Network error. Please try again.");
    expect(captureAnalysisEvent).toHaveBeenLastCalledWith(
      "analysis_failed",
      "sample",
      "interview",
      {
        stage: "network",
        error_code: "NETWORK_ERROR",
      }
    );
  });
});
