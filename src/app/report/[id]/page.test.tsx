import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { buildSampleReport } from "@/lib/buildSampleReport";
import { REPORT_VERSION } from "@/types/report";
import SharedReportPage from "./page";

const route = vi.hoisted(() => ({
  params: { id: "00000000-0000-4000-8000-000000000000" } as {
    id?: string;
  },
}));
const reportTabsProps = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useParams: () => route.params,
}));

vi.mock("@/components/ReportTabs", () => ({
  ReportTabs: (props: Record<string, unknown>) => {
    reportTabsProps(props);
    return <div data-testid="report-tabs">Read-only Candidate Brief</div>;
  },
}));

const fetchMock = vi.fn();

function response({
  ok = true,
  data,
  rejects = false,
}: {
  ok?: boolean;
  data?: unknown;
  rejects?: boolean;
}) {
  return {
    ok,
    json: rejects
      ? vi.fn().mockRejectedValue(new SyntaxError("invalid JSON"))
      : vi.fn().mockResolvedValue(data),
  } as unknown as Response;
}

beforeEach(() => {
  route.params = { id: "00000000-0000-4000-8000-000000000000" };
  fetchMock.mockReset();
  reportTabsProps.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("stored Candidate Brief loading", () => {
  it("shows a recovery action when the report id is missing", () => {
    route.params = {};

    render(<SharedReportPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("Missing report id.");
    expect(
      screen.getByRole("link", { name: "Start a new analysis" })
    ).toHaveAttribute("href", "/#analyze");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows loading while the report request is pending", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    render(<SharedReportPage />);

    expect(screen.getByText("Loading report…")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  });

  it("renders a validated stored report as a live read-only brief", async () => {
    const report = buildSampleReport();
    fetchMock.mockResolvedValue(response({ data: report }));

    render(<SharedReportPage />);

    expect(await screen.findByTestId("report-tabs")).toBeInTheDocument();
    expect(reportTabsProps).toHaveBeenCalledWith({
      report,
      reportId: route.params.id,
      variant: "live",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/reports/${route.params.id}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("shows the API recovery message for a missing stored report", async () => {
    fetchMock.mockResolvedValue(
      response({
        ok: false,
        data: { message: "Report not found." },
      })
    );

    render(<SharedReportPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Report not found."
    );
    expect(reportTabsProps).not.toHaveBeenCalled();
  });

  it("uses a bounded recovery message for malformed API errors", async () => {
    fetchMock.mockResolvedValue(
      response({ ok: false, data: { message: 42 } })
    );

    render(<SharedReportPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Report not found."
    );
  });

  it("rejects a non-JSON successful response before rendering", async () => {
    fetchMock.mockResolvedValue(response({ rejects: true }));

    render(<SharedReportPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This report could not be opened because its data is incomplete or invalid."
    );
    expect(reportTabsProps).not.toHaveBeenCalled();
  });

  it("rejects an incomplete successful response before rendering", async () => {
    fetchMock.mockResolvedValue(response({ data: {} }));

    render(<SharedReportPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This report could not be opened because its data is incomplete or invalid."
    );
    expect(reportTabsProps).not.toHaveBeenCalled();
  });

  it("explains when a report uses an unsupported schema version", async () => {
    fetchMock.mockResolvedValue(
      response({
        data: {
          ...buildSampleReport(),
          report_version: REPORT_VERSION + 1,
        },
      })
    );

    render(<SharedReportPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This report was created by an unsupported RepoAtlas version."
    );
  });

  it("shows a bounded recovery when the request fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("network details"));

    render(<SharedReportPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to load report."
    );
  });

  it("aborts the request and ignores its failure after unmount", async () => {
    let requestSignal: AbortSignal | undefined;
    fetchMock.mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          requestSignal = init?.signal ?? undefined;
          requestSignal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        })
    );

    const view = render(<SharedReportPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    view.unmount();

    expect(requestSignal?.aborted).toBe(true);
  });
});
