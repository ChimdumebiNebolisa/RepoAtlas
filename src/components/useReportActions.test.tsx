import React from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSampleReport } from "@/lib/buildSampleReport";
import {
  INLINE_MARKDOWN_UNAVAILABLE,
  useReportActions,
} from "./useReportActions";

const html2canvas = vi.hoisted(() => vi.fn());
const createPortableShareLink = vi.hoisted(() => vi.fn());
const captureProductEvent = vi.hoisted(() => vi.fn());
const captureReportExportFailure = vi.hoisted(() => vi.fn());
const captureReportShared = vi.hoisted(() => vi.fn());
const pdfAddImage = vi.hoisted(() => vi.fn());
const pdfAddPage = vi.hoisted(() => vi.fn());
const pdfOutput = vi.hoisted(() => vi.fn(() => new Blob(["pdf"])));
const pdfSetProperties = vi.hoisted(() => vi.fn());

vi.mock("html2canvas", () => ({ default: html2canvas }));
vi.mock("jspdf", () => ({
  default: class MockJsPdf {
    internal = {
      pageSize: {
        getWidth: () => 595,
        getHeight: () => 842,
      },
    };
    addImage = pdfAddImage;
    addPage = pdfAddPage;
    output = pdfOutput;
    setProperties = pdfSetProperties;
  },
}));
vi.mock("@/lib/portableSharing", () => ({ createPortableShareLink }));
vi.mock("@/lib/productAnalytics", () => ({
  captureProductEvent,
  captureReportExportFailure,
  captureReportShared,
}));

function response({
  ok = true,
  status = 200,
  json = {},
  text = "# Candidate Brief",
  disposition = null,
}: {
  ok?: boolean;
  status?: number;
  json?: unknown;
  text?: string;
  disposition?: string | null;
} = {}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(json),
    text: vi.fn().mockResolvedValue(text),
    headers: new Headers(
      disposition ? { "Content-Disposition": disposition } : undefined
    ),
  } as unknown as Response;
}

function makeCanvas({ blob = new Blob(["image"]) }: { blob?: Blob | null } = {}) {
  return {
    width: 1200,
    height: 1800,
    toBlob: (callback: BlobCallback) => callback(blob),
  } as unknown as HTMLCanvasElement;
}

function attachExportNode(
  setExportNode: (node: HTMLDivElement | null) => void,
  architectureState?: "loading"
) {
  const node = document.createElement("div");
  Object.defineProperties(node, {
    scrollWidth: { configurable: true, value: 1200 },
    scrollHeight: { configurable: true, value: 1800 },
  });
  if (architectureState) {
    const architecture = document.createElement("div");
    architecture.dataset.architectureState = architectureState;
    node.appendChild(architecture);
  }
  act(() => setExportNode(node));
  return node;
}

describe("useReportActions", () => {
  const report = buildSampleReport();
  let fetchMock: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let createObjectUrl: ReturnType<typeof vi.fn>;
  let revokeObjectUrl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    createObjectUrl = vi.fn(() => "blob:report");
    revokeObjectUrl = vi.fn();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    });
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    Object.defineProperty(window.navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    html2canvas.mockReset();
    createPortableShareLink.mockReset();
    captureProductEvent.mockReset();
    captureReportExportFailure.mockReset();
    captureReportShared.mockReset();
    pdfAddImage.mockReset();
    pdfAddPage.mockReset();
    pdfOutput.mockClear();
    pdfSetProperties.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("marks Markdown unavailable for inline reports without fetching", async () => {
    const { result } = renderHook(() =>
      useReportActions({ report, variant: "live" })
    );

    expect(result.current.markdownSupport).toBe("unavailable");
    expect(result.current.markdownNote).toBe(INLINE_MARKDOWN_UNAVAILABLE);
    await act(() => result.current.handleExportMarkdown());
    expect(result.current.exportError).toBe(INLINE_MARKDOWN_UNAVAILABLE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([200, 405])(
    "accepts a successful Markdown preflight status %s",
    async (status) => {
      fetchMock.mockResolvedValueOnce(response({ ok: status === 200, status }));
      const { result } = renderHook(() =>
        useReportActions({ report, reportId: "report-1", variant: "live" })
      );

      await waitFor(() => expect(result.current.markdownSupport).toBe("available"));
      expect(result.current.markdownNote).toBeNull();
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/reports/report-1/export/md",
        { method: "HEAD" }
      );
    }
  );

  it("explains a failed Markdown preflight and blocks retrieval", async () => {
    fetchMock.mockResolvedValueOnce(response({ ok: false, status: 503 }));
    const { result } = renderHook(() =>
      useReportActions({ report, reportId: "report-1", variant: "live" })
    );

    await waitFor(() => expect(result.current.markdownSupport).toBe("unavailable"));
    expect(result.current.markdownNote).toContain("HTTP 503");
    await act(() => result.current.handleExportMarkdown());
    expect(result.current.exportError).toContain("HTTP 503");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps Markdown retryable when preflight cannot connect", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() =>
      useReportActions({ report, reportId: "report-1", variant: "live" })
    );

    await waitFor(() => expect(result.current.markdownNote).toContain("Could not verify"));
    expect(result.current.markdownSupport).toBe("unknown");
  });

  it("downloads Markdown using the server filename and records one success", async () => {
    fetchMock
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(
        response({ disposition: 'attachment; filename="repo-brief.md"' })
      );
    const { result } = renderHook(() =>
      useReportActions({ report, reportId: "report-1", variant: "live" })
    );
    await waitFor(() => expect(result.current.markdownSupport).toBe("available"));

    await act(() => result.current.handleExportMarkdown());

    expect(result.current.exporting).toBeNull();
    expect(result.current.exportError).toBeNull();
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:report");
    expect(captureProductEvent).toHaveBeenCalledWith("report_exported", {
      format: "markdown",
      report_variant: "live",
    });
  });

  it("reports a bounded Markdown HTTP failure and clears exporting state", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(
        response({
          ok: false,
          status: 502,
          json: { code: "UPSTREAM", message: "Storage unavailable" },
        })
      );
    const { result } = renderHook(() =>
      useReportActions({ report, reportId: "report-1", variant: "shared" })
    );
    await waitFor(() => expect(result.current.markdownSupport).toBe("available"));

    await act(() => result.current.handleExportMarkdown());

    expect(result.current.exporting).toBeNull();
    expect(result.current.exportError).toContain("UPSTREAM: Storage unavailable");
    expect(captureReportExportFailure).toHaveBeenCalledWith(
      "markdown",
      "shared",
      "http_error",
      502
    );
    expect(consoleSpy).toHaveBeenCalledWith("Markdown export request failed", {
      status: 502,
    });
  });

  it("reports a Markdown network failure and clears exporting state", async () => {
    fetchMock
      .mockResolvedValueOnce(response())
      .mockRejectedValueOnce(new Error("Network unavailable"));
    const { result } = renderHook(() =>
      useReportActions({ report, reportId: "report-1", variant: "live" })
    );
    await waitFor(() => expect(result.current.markdownSupport).toBe("available"));

    await act(() => result.current.handleExportMarkdown());

    expect(result.current.exporting).toBeNull();
    expect(result.current.exportError).toBe("Network unavailable");
    expect(captureReportExportFailure).toHaveBeenCalledWith(
      "markdown",
      "live",
      "request_failed"
    );
  });

  it.each(["png", "pdf"] as const)(
    "clears %s state when the export snapshot mount is missing",
    async (format) => {
      const { result } = renderHook(() =>
        useReportActions({ report, variant: "live" })
      );

      await act(() =>
        format === "png"
          ? result.current.handleExportPng()
          : result.current.handleExportPdf()
      );

      expect(result.current.exporting).toBeNull();
      expect(result.current.exportMountActive).toBe(false);
      expect(result.current.exportError).toBe("Report snapshot is not ready yet.");
      expect(captureReportExportFailure).toHaveBeenCalledWith(
        format,
        "live",
        "render_failed"
      );
    }
  );

  it("clears the export mount after an architecture-render timeout", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T00:00:00Z"));
    const { result } = renderHook(() =>
      useReportActions({ report, variant: "live" })
    );
    attachExportNode(result.current.setExportNode, "loading");

    let exportPromise: Promise<void> | undefined;
    act(() => {
      exportPromise = result.current.handleExportPng();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_100);
      await exportPromise;
    });

    expect(result.current.exporting).toBeNull();
    expect(result.current.exportMountActive).toBe(false);
    expect(result.current.exportError).toBe(
      "The architecture map did not finish loading for export."
    );
    expect(html2canvas).not.toHaveBeenCalled();
  });

  it("reports a PNG rendering failure and clears both loading indicators", async () => {
    html2canvas.mockRejectedValueOnce(new Error("Canvas blocked"));
    const { result } = renderHook(() =>
      useReportActions({ report, variant: "preview" })
    );
    attachExportNode(result.current.setExportNode);

    await act(() => result.current.handleExportPng());

    expect(result.current.exporting).toBeNull();
    expect(result.current.exportMountActive).toBe(false);
    expect(result.current.exportError).toBe("Canvas blocked");
    expect(captureReportExportFailure).toHaveBeenCalledWith(
      "png",
      "preview",
      "render_failed"
    );
  });

  it("reports a missing PNG blob and leaves the next action available", async () => {
    html2canvas.mockResolvedValueOnce(makeCanvas({ blob: null }));
    const { result } = renderHook(() =>
      useReportActions({ report, variant: "live" })
    );
    attachExportNode(result.current.setExportNode);

    await act(() => result.current.handleExportPng());

    expect(result.current.exporting).toBeNull();
    expect(result.current.exportMountActive).toBe(false);
    expect(result.current.exportError).toBe("Could not generate PNG image.");
    expect(captureProductEvent).not.toHaveBeenCalled();
  });

  it("downloads a PNG and records one successful export", async () => {
    html2canvas.mockResolvedValueOnce(makeCanvas());
    const { result } = renderHook(() =>
      useReportActions({ report, variant: "live" })
    );
    attachExportNode(result.current.setExportNode);

    await act(() => result.current.handleExportPng());

    expect(result.current.exportError).toBeNull();
    expect(result.current.exporting).toBeNull();
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(captureProductEvent).toHaveBeenCalledWith("report_exported", {
      format: "png",
      report_variant: "live",
    });
  });

  it("reports a PDF page failure and clears both loading indicators", async () => {
    html2canvas.mockResolvedValueOnce(makeCanvas());
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName === "canvas") {
        vi.spyOn(element as HTMLCanvasElement, "getContext").mockReturnValue(null);
      }
      return element;
    });
    const { result } = renderHook(() =>
      useReportActions({ report, variant: "live" })
    );
    attachExportNode(result.current.setExportNode);

    await act(() => result.current.handleExportPdf());

    expect(result.current.exporting).toBeNull();
    expect(result.current.exportMountActive).toBe(false);
    expect(result.current.exportError).toBe("Could not prepare a PDF page.");
    expect(captureReportExportFailure).toHaveBeenCalledWith(
      "pdf",
      "live",
      "render_failed"
    );
  });

  it("creates a stored private link and counts a native share once", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "share", {
      configurable: true,
      value: share,
    });
    fetchMock
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(
        response({
          json: {
            sharePath: "/share/private-1",
            expiresAt: "2026-07-28T00:00:00.000Z",
          },
        })
      )
      .mockResolvedValueOnce(
        response({
          json: {
            sharePath: "/share/private-1",
            expiresAt: "2026-07-28T00:00:00.000Z",
          },
        })
      );
    const { result } = renderHook(() =>
      useReportActions({ report, reportId: "report-1", variant: "live" })
    );
    await waitFor(() => expect(result.current.markdownSupport).toBe("available"));

    await act(() => result.current.handleShareCandidateBrief());
    await act(() => result.current.handleShareCandidateBrief());

    expect(result.current.shareLoading).toBe(false);
    expect(result.current.shareError).toBeNull();
    expect(result.current.shareUrl).toBe(`${window.location.origin}/share/private-1`);
    expect(result.current.shareMessage).toContain("Shared successfully");
    expect(share).toHaveBeenCalledTimes(2);
    expect(captureReportShared).toHaveBeenCalledTimes(1);
    expect(captureReportShared).toHaveBeenCalledWith("native", "stored_link");
  });

  it("treats native-share cancellation as neutral and records no success", async () => {
    Object.defineProperty(window.navigator, "share", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")),
    });
    createPortableShareLink.mockResolvedValueOnce({
      url: "https://example.com/shared#payload",
      expiresAt: "2026-07-28T00:00:00.000Z",
    });
    const { result } = renderHook(() =>
      useReportActions({ report, variant: "live" })
    );

    await act(() => result.current.handleShareCandidateBrief());

    expect(result.current.shareLoading).toBe(false);
    expect(result.current.shareError).toBeNull();
    expect(result.current.shareMessage).toBeNull();
    expect(captureReportShared).not.toHaveBeenCalled();
  });

  it("falls back to copying a portable link and records one success", async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error("blocked"));
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });
    createPortableShareLink.mockResolvedValueOnce({
      url: "https://example.com/shared#payload",
      expiresAt: "2026-07-28T00:00:00.000Z",
    });
    const { result } = renderHook(() =>
      useReportActions({ report, variant: "live" })
    );

    await act(() => result.current.handleShareCandidateBrief());

    expect(result.current.shareLoading).toBe(false);
    expect(result.current.shareMessage).toContain("Private link copied");
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
    expect(captureReportShared).toHaveBeenCalledWith("clipboard", "portable_link");
  });

  it.each([
    ["stored", true, "Stored share unavailable"],
    ["portable", false, "Portable share unavailable"],
  ] as const)(
    "shows a PDF fallback when %s link creation fails",
    async (_kind, stored, message) => {
      if (stored) {
        fetchMock
          .mockResolvedValueOnce(response())
          .mockResolvedValueOnce(
            response({ ok: false, status: 503, json: { message } })
          );
      } else {
        createPortableShareLink.mockRejectedValueOnce(new Error(message));
      }
      const { result } = renderHook(() =>
        useReportActions({
          report,
          reportId: stored ? "report-1" : undefined,
          variant: "live",
        })
      );
      if (stored) {
        await waitFor(() => expect(result.current.markdownSupport).toBe("available"));
      }

      await act(() => result.current.handleShareCandidateBrief());

      expect(result.current.shareLoading).toBe(false);
      expect(result.current.shareError).toBe(message);
      expect(result.current.shareMessage).toBeNull();
      expect(captureReportShared).not.toHaveBeenCalled();
    }
  );

  it("reports clipboard failure without counting a successful share", async () => {
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => false),
    });
    createPortableShareLink.mockResolvedValueOnce({
      url: "https://example.com/shared#payload",
      expiresAt: "2026-07-28T00:00:00.000Z",
    });
    const { result } = renderHook(() =>
      useReportActions({ report, variant: "live" })
    );

    await act(() => result.current.handleShareCandidateBrief());

    expect(result.current.shareLoading).toBe(false);
    expect(result.current.shareError).toContain("Export PDF");
    expect(captureReportShared).not.toHaveBeenCalled();
  });

  it("ignores share actions outside live reports", async () => {
    const { result } = renderHook(() =>
      useReportActions({ report, variant: "preview" })
    );

    await act(() => result.current.handleShareCandidateBrief());

    expect(createPortableShareLink).not.toHaveBeenCalled();
    expect(result.current.shareLoading).toBe(false);
  });
});
