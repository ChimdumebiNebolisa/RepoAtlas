import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSampleReport } from "@/lib/buildSampleReport";
import {
  CandidateBriefSharePrompt,
  HiddenReportExport,
  ReportActionFeedback,
  ReportExportPanel,
  ReportToolbar,
} from "./ReportActionViews";
import type { ReportActionsState } from "./useReportActions";

vi.mock("./ReportDocument", () => ({
  ReportDocument: () => <div>Rendered report document</div>,
}));

function makeActions(overrides: Partial<ReportActionsState> = {}): ReportActionsState {
  return {
    exporting: null,
    exportError: null,
    exportMountActive: false,
    setExportNode: vi.fn(),
    markdownSupport: "available",
    markdownNote: null,
    shareUrl: null,
    shareExpiresAt: null,
    shareLoading: false,
    shareError: null,
    shareMessage: null,
    handleExportPng: vi.fn().mockResolvedValue(undefined),
    handleExportPdf: vi.fn().mockResolvedValue(undefined),
    handleExportMarkdown: vi.fn().mockResolvedValue(undefined),
    handleShareCandidateBrief: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

afterEach(cleanup);

describe("ReportToolbar", () => {
  it.each([
    ["preview", null, "Read-only sample."],
    ["shared", "report-1", "Shared read-only Candidate Brief."],
    ["live", null, "Generated report ready for PDF and PNG export"],
    ["live", "report-1", "Generated report ready for PDF, PNG, and Markdown export."],
  ] as const)(
    "explains the %s report capabilities",
    (variant, reportId, expectedSummary) => {
      render(
        <ReportToolbar
          actions={makeActions()}
          reportId={reportId}
          tabsId="report"
          variant={variant}
        />
      );

      expect(
        screen.getByText((content) => content.includes(expectedSummary))
      ).toBeInTheDocument();
      const markdownButton = screen.getByRole("button", { name: "Export Markdown" });
      if (variant === "preview" || reportId === null) {
        expect(markdownButton).toBeDisabled();
      } else {
        expect(markdownButton).toBeEnabled();
      }
    }
  );

  it("runs all available toolbar actions", async () => {
    const actions = makeActions();
    const user = userEvent.setup();
    render(
      <ReportToolbar actions={actions} reportId="report-1" tabsId="report" variant="live" />
    );

    await user.click(screen.getByRole("button", { name: "Export PDF" }));
    await user.click(screen.getByRole("button", { name: "Export PNG" }));
    await user.click(screen.getByRole("button", { name: "Export Markdown" }));

    expect(actions.handleExportPdf).toHaveBeenCalledTimes(1);
    expect(actions.handleExportPng).toHaveBeenCalledTimes(1);
    expect(actions.handleExportMarkdown).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["pdf", "Exporting PDF..."],
    ["png", "Exporting PNG..."],
    ["md", "Exporting Markdown..."],
  ] as const)("shows %s progress and locks every toolbar action", (exporting, label) => {
    render(
      <ReportToolbar
        actions={makeActions({ exporting })}
        reportId="report-1"
        tabsId="report"
        variant="live"
      />
    );

    expect(screen.getByRole("button", { name: label })).toBeDisabled();
    screen.getAllByRole("button").forEach((button) => expect(button).toBeDisabled());
  });

  it("blocks Markdown only while the availability check is pending", () => {
    const { rerender } = render(
      <ReportToolbar
        actions={makeActions({
          markdownSupport: "unknown",
          markdownNote: "Checking Markdown export availability...",
        })}
        reportId="report-1"
        tabsId="report"
        variant="live"
      />
    );

    expect(screen.getByText(/Checking Markdown export availability/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Markdown" })).toBeDisabled();

    rerender(
      <ReportToolbar
        actions={makeActions({
          markdownSupport: "unknown",
          markdownNote: "Could not verify Markdown export availability. You can still try exporting.",
        })}
        reportId="report-1"
        tabsId="report"
        variant="live"
      />
    );
    expect(screen.getByRole("button", { name: "Export Markdown" })).toBeEnabled();
  });

  it("explains unavailable and unknown Markdown states", () => {
    const { rerender } = render(
      <ReportToolbar
        actions={makeActions({
          markdownSupport: "unavailable",
          markdownNote: "Markdown storage is unavailable.",
        })}
        reportId="report-1"
        tabsId="report"
        variant="live"
      />
    );

    expect(screen.getByText(/Markdown storage is unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Markdown" })).toBeDisabled();

    rerender(
      <ReportToolbar
        actions={makeActions({ markdownSupport: "unknown", markdownNote: null })}
        reportId="report-1"
        tabsId="report"
        variant="live"
      />
    );
    expect(screen.getByText(/availability could not be verified/)).toBeInTheDocument();
  });
});

describe("CandidateBriefSharePrompt", () => {
  it("shares the brief and shows only current success details", async () => {
    const actions = makeActions({
      shareMessage: "Private link copied. It expires in 7 days.",
      shareUrl: "https://example.com/share/brief",
      shareExpiresAt: "2026-07-29T12:00:00.000Z",
    });
    const user = userEvent.setup();
    render(<CandidateBriefSharePrompt actions={actions} tabsId="report" />);

    await user.click(screen.getByRole("button", { name: "Share Candidate Brief" }));
    expect(actions.handleShareCandidateBrief).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Private link copied");
    expect(screen.getByRole("link", { name: "Open shared copy" })).toHaveAttribute(
      "href",
      actions.shareUrl
    );
    expect(screen.getByText(/^Expires /)).toBeInTheDocument();
  });

  it("shows native-share success without inventing an open-copy link", () => {
    render(
      <CandidateBriefSharePrompt
        actions={makeActions({ shareMessage: "Shared successfully." })}
        tabsId="report"
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Shared successfully.");
    expect(screen.queryByRole("link", { name: "Open shared copy" })).not.toBeInTheDocument();
  });

  it("locks the share action while a private link is being prepared", () => {
    render(
      <CandidateBriefSharePrompt actions={makeActions({ shareLoading: true })} tabsId="report" />
    );

    expect(screen.getByRole("button", { name: /Preparing private link/ })).toBeDisabled();
  });

  it("shows PDF recovery without stale expiry details after a share failure", async () => {
    const actions = makeActions({
      shareError: "Could not create a private link.",
      shareExpiresAt: "2026-07-29T12:00:00.000Z",
    });
    const user = userEvent.setup();
    render(<CandidateBriefSharePrompt actions={actions} tabsId="report" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Could not create a private link.");
    expect(screen.queryByText(/^Expires /)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Export PDF instead" }));
    expect(actions.handleExportPdf).toHaveBeenCalledTimes(1);
  });

  it("shows PDF recovery progress and locks it during any export", () => {
    render(
      <CandidateBriefSharePrompt
        actions={makeActions({ shareError: "Share failed.", exporting: "pdf" })}
        tabsId="report"
      />
    );

    expect(screen.getByRole("button", { name: "Exporting PDF..." })).toBeDisabled();
  });
});

describe("ReportExportPanel", () => {
  it("runs each export and explains Markdown availability", async () => {
    const actions = makeActions({ markdownNote: "Markdown is ready." });
    const user = userEvent.setup();
    render(<ReportExportPanel actions={actions} reportId="report-1" />);

    await user.click(screen.getByRole("button", { name: "Export Full Report (PDF)" }));
    await user.click(screen.getByRole("button", { name: "Export Full Report (PNG)" }));
    await user.click(screen.getByRole("button", { name: "Export Markdown" }));

    expect(actions.handleExportPdf).toHaveBeenCalledTimes(1);
    expect(actions.handleExportPng).toHaveBeenCalledTimes(1);
    expect(actions.handleExportMarkdown).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Markdown is ready.")).toBeInTheDocument();
  });

  it.each([
    ["pdf", "Exporting PDF..."],
    ["png", "Exporting PNG..."],
    ["md", "Exporting Markdown..."],
  ] as const)("shows %s progress and locks every panel action", (exporting, label) => {
    render(<ReportExportPanel actions={makeActions({ exporting })} reportId="report-1" />);

    expect(screen.getByRole("button", { name: label })).toBeDisabled();
    screen.getAllByRole("button").forEach((button) => expect(button).toBeDisabled());
  });

  it.each([
    [null, "available", null],
    ["report-1", "unavailable", "Markdown is unavailable."],
    ["report-1", "unknown", "Checking Markdown export availability..."],
  ] as const)(
    "disables Markdown for report %s with %s support",
    (reportId, markdownSupport, markdownNote) => {
      render(
        <ReportExportPanel
          actions={makeActions({ markdownSupport, markdownNote })}
          reportId={reportId}
        />
      );

      expect(screen.getByRole("button", { name: "Export Markdown" })).toBeDisabled();
    }
  );

  it("keeps Markdown retryable after an availability connection failure", () => {
    render(
      <ReportExportPanel
        actions={makeActions({
          markdownSupport: "unknown",
          markdownNote: "Could not verify Markdown export availability. You can still try exporting.",
        })}
        reportId="report-1"
      />
    );

    expect(screen.getByRole("button", { name: "Export Markdown" })).toBeEnabled();
  });
});

describe("ReportActionFeedback", () => {
  it("announces an export failure", () => {
    render(<ReportActionFeedback actions={makeActions({ exportError: "PDF export failed." })} />);
    expect(screen.getByText("PDF export failed.")).toBeInTheDocument();
  });

  it("renders nothing when exports are healthy", () => {
    const { container } = render(<ReportActionFeedback actions={makeActions()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("HiddenReportExport", () => {
  it("does not mount export content until an export starts", () => {
    const { container } = render(
      <HiddenReportExport
        exportMountActive={false}
        registerExportNode={vi.fn()}
        report={buildSampleReport()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("mounts the complete export snapshot and registers its node", () => {
    const registerExportNode = vi.fn();
    const report = buildSampleReport();
    render(
      <HiddenReportExport
        exportMountActive
        registerExportNode={registerExportNode}
        report={report}
      />
    );

    expect(
      screen.getByRole("heading", { name: `Repo Analysis: ${report.repo_metadata.name}` })
    ).toBeInTheDocument();
    expect(screen.getByText("Rendered report document")).toBeInTheDocument();
    expect(registerExportNode).toHaveBeenCalledWith(expect.any(HTMLDivElement));
  });
});
