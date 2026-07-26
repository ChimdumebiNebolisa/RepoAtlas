import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSampleReport } from "@/lib/buildSampleReport";
import { useAnalysisRequest } from "./useAnalysisRequest";

const captureAnalysisEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/productAnalytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/productAnalytics")>();
  return { ...actual, captureAnalysisEvent };
});

const reportId = "11111111-1111-4111-8111-111111111111";

function successfulJson(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function renderRequest() {
  const onAnalyzeComplete = vi.fn();
  const onAnalyzeError = vi.fn();
  const { result } = renderHook(() =>
    useAnalysisRequest({
      analysisIntent: "interview",
      onAnalyzeComplete,
      onAnalyzeError,
    })
  );
  return { request: result.current, onAnalyzeComplete, onAnalyzeError };
}

describe("useAnalysisRequest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    captureAnalysisEvent.mockClear();
    window.history.replaceState({}, "", "/");
  });

  it("rejects a malformed successful analysis response before completion", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(successfulJson("not a response"));
    const { request, onAnalyzeComplete, onAnalyzeError } = renderRequest();

    await act(() => request({}, "sample"));

    expect(onAnalyzeComplete).not.toHaveBeenCalled();
    expect(onAnalyzeError).toHaveBeenCalledWith(
      "Invalid response: missing or malformed reportId."
    );
    expect(captureAnalysisEvent).toHaveBeenLastCalledWith(
      "analysis_failed",
      "sample",
      "interview",
      {
        stage: "analysis_response",
        error_code: "INVALID_REPORT_ID",
      }
    );
  });

  it("rejects an incomplete inline report without recording completion", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      successfulJson({
        reportId,
        persisted: false,
        report: { repo_metadata: {} },
      })
    );
    const { request, onAnalyzeComplete, onAnalyzeError } = renderRequest();

    await act(() => request({}, "zip"));

    expect(onAnalyzeComplete).not.toHaveBeenCalled();
    expect(onAnalyzeError).toHaveBeenCalledWith(
      "Invalid response: incomplete or malformed report data."
    );
    expect(captureAnalysisEvent).toHaveBeenLastCalledWith(
      "analysis_failed",
      "zip",
      "interview",
      {
        stage: "analysis_response",
        error_code: "ANALYSIS_FAILED",
      }
    );
  });

  it("preserves a valid inline report and accepted attribution", async () => {
    const report = buildSampleReport();
    window.history.replaceState({}, "", "/?source=interview_preparation#analyze");
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      successfulJson({ reportId, persisted: false, report })
    );
    const { request, onAnalyzeComplete, onAnalyzeError } = renderRequest();

    await act(() => request({ method: "POST" }, "github"));

    expect(fetchMock).toHaveBeenCalledWith("/api/analyze", { method: "POST" });
    expect(onAnalyzeComplete).toHaveBeenCalledWith(report, null);
    expect(onAnalyzeError).not.toHaveBeenCalled();
    expect(captureAnalysisEvent).toHaveBeenNthCalledWith(
      1,
      "analysis_started",
      "github",
      "interview",
      { entry_source: "interview_preparation" }
    );
    expect(captureAnalysisEvent).toHaveBeenNthCalledWith(
      2,
      "analysis_completed",
      "github",
      "interview",
      { entry_source: "interview_preparation" }
    );
  });

  it("rejects an incomplete stored report without recording completion", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(successfulJson({ reportId, persisted: true }))
      .mockResolvedValueOnce(successfulJson({ repo_metadata: {} }));
    const { request, onAnalyzeComplete, onAnalyzeError } = renderRequest();

    await act(() => request({}, "sample"));

    expect(fetchMock).toHaveBeenNthCalledWith(2, `/api/reports/${reportId}`);
    expect(onAnalyzeComplete).not.toHaveBeenCalled();
    expect(onAnalyzeError).toHaveBeenCalledWith(
      "Invalid response: incomplete or malformed report data."
    );
    expect(captureAnalysisEvent).toHaveBeenLastCalledWith(
      "analysis_failed",
      "sample",
      "interview",
      {
        stage: "report_load",
        error_code: "ANALYSIS_FAILED",
      }
    );
  });

  it("preserves a valid stored report and its identifier", async () => {
    const report = buildSampleReport();
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(successfulJson({ reportId, persisted: true }))
      .mockResolvedValueOnce(successfulJson(report));
    const { request, onAnalyzeComplete, onAnalyzeError } = renderRequest();

    await act(() => request({}, "sample"));

    expect(onAnalyzeComplete).toHaveBeenCalledWith(report, reportId);
    expect(onAnalyzeError).not.toHaveBeenCalled();
    expect(captureAnalysisEvent).toHaveBeenLastCalledWith(
      "analysis_completed",
      "sample",
      "interview",
      {}
    );
  });
});
