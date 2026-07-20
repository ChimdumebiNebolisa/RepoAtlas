import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildSampleReport } from "@/lib/buildSampleReport";
import { ReportTabs } from "./ReportTabs";

const createPortableShareLink = vi.hoisted(() => vi.fn());
const captureReportShared = vi.hoisted(() => vi.fn());

vi.mock("@/lib/portableSharing", () => ({ createPortableShareLink }));
vi.mock("@/lib/productAnalytics", () => ({
  captureProductEvent: vi.fn(),
  captureReportExportFailure: vi.fn(),
  captureReportShared,
}));

beforeEach(() => {
  createPortableShareLink.mockReset();
  captureReportShared.mockReset();
  Object.defineProperty(window.navigator, "share", {
    configurable: true,
    value: undefined,
  });
});

afterEach(cleanup);

describe("ReportTabs inline-share recovery", () => {
  it.each([
    "Private links are not supported in this browser. Export PDF to share this brief.",
    "This brief is too large for a private link. Export PDF to share it instead.",
  ])("shows a PDF recovery without counting a failed share: %s", async (message) => {
    createPortableShareLink.mockRejectedValueOnce(new Error(message));
    const user = userEvent.setup();

    render(<ReportTabs report={buildSampleReport()} />);
    await user.click(screen.getByRole("button", { name: "Share Candidate Brief" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Export PDF instead" })).toBeEnabled();
    expect(screen.queryByText(/Shared successfully|Private link copied/i)).not.toBeInTheDocument();
    expect(captureReportShared).not.toHaveBeenCalled();
  });
});
