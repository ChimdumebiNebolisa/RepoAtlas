"use client";

import { useState, useRef, useEffect, type RefObject } from "react";
import type { Report } from "@/types/report";
import { ERROR_CODES } from "@/lib/errors";

const FALLBACK_ANALYSIS_MESSAGE = "Analysis failed. Check server logs.";

const ANALYSIS_STAGES = [
  "Uploading…",
  "Extracting zip…",
  "Building folder map…",
  "Running language packs…",
  "Scoring risk hotspots…",
  "Building Candidate Brief…",
  "Saving report…",
] as const;

interface InputFormProps {
  onAnalyzeStart: () => void;
  onAnalyzeComplete: (report: Report, reportId: string) => void;
  onAnalyzeError: (message: string) => void;
  loading: boolean;
  sampleButtonRef?: RefObject<HTMLButtonElement>;
}

interface ApiErrorLike {
  code?: string;
  message?: string;
}

export function formatApiError(payload: ApiErrorLike | null | undefined, fallback: string) {
  if (!payload) return fallback;
  if (payload.code && payload.message) return `${payload.code}: ${payload.message}`;
  return payload.message || payload.code || fallback;
}

export function formatReportFetchError(
  payload: ApiErrorLike | null | undefined,
  status: number,
  reportId: string
) {
  const base = formatApiError(payload, FALLBACK_ANALYSIS_MESSAGE);
  return `Failed to load analysis report (${reportId}, HTTP ${status}). ${base}`;
}

export function InputForm({
  onAnalyzeStart,
  onAnalyzeComplete,
  onAnalyzeError,
  loading,
  sampleButtonRef,
}: InputFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) {
      setStageIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setStageIndex((prev) => Math.min(prev + 1, ANALYSIS_STAGES.length - 1));
    }, 4000);
    return () => clearInterval(timer);
  }, [loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || loading) return;

    onAnalyzeStart();

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        onAnalyzeError(formatApiError(data, FALLBACK_ANALYSIS_MESSAGE));
        return;
      }

      const { reportId } = data;
      if (!reportId) {
        onAnalyzeError("Invalid response: missing reportId");
        return;
      }

      const reportRes = await fetch(`/api/reports/${reportId}`);
      const reportPayload = await reportRes.json().catch(() => ({}));
      if (!reportRes.ok) {
        console.error("Failed to fetch analyzed report", {
          reportId,
          status: reportRes.status,
          code: reportPayload.code ?? ERROR_CODES.ANALYSIS_FAILED,
          message: reportPayload.message ?? FALLBACK_ANALYSIS_MESSAGE,
        });
        onAnalyzeError(formatReportFetchError(reportPayload, reportRes.status, reportId));
        return;
      }

      const report: Report = reportPayload;
      onAnalyzeComplete(report, reportId);
    } catch (error) {
      console.error("Unexpected error during analysis submission", error);
      onAnalyzeError("Network error. Please try again.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    if (!chosen) {
      setFile(null);
      return;
    }
    if (!chosen.name.toLowerCase().endsWith(".zip")) {
      onAnalyzeError("Please select a .zip file.");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(chosen);
  };

  const handleSample = async () => {
    if (loading) return;
    onAnalyzeStart();
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sample: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onAnalyzeError(formatApiError(data, FALLBACK_ANALYSIS_MESSAGE));
        return;
      }
      const { reportId } = data;
      const reportRes = await fetch(`/api/reports/${reportId}`);
      const reportPayload = await reportRes.json().catch(() => ({}));
      if (!reportRes.ok) {
        onAnalyzeError(formatReportFetchError(reportPayload, reportRes.status, reportId));
        return;
      }
      onAnalyzeComplete(reportPayload as Report, reportId);
    } catch {
      onAnalyzeError("Network error. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="input-form" aria-busy={loading}>
      <div>
        <label htmlFor="zipFile" className="input-label">
          Repository zip file
        </label>
        <div className="file-picker">
          <input
            ref={inputRef}
            id="zipFile"
            type="file"
            accept=".zip"
            onChange={handleFileChange}
            className="absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            disabled={loading}
            aria-label="Choose repository zip file"
          />
          <span className="file-name">
            {file ? file.name : "No file chosen"}
          </span>
          <span className="file-action">
            Choose file
          </span>
        </div>
      </div>
      <div className="form-actions">
        <button
          type="submit"
          disabled={loading || !file}
          className="btn btn-primary"
        >
          <span aria-live="polite">
            {loading ? ANALYSIS_STAGES[stageIndex] : "Analyze Repository"}
          </span>
        </button>
        <button
          ref={sampleButtonRef}
          type="button"
          disabled={loading}
          onClick={handleSample}
          className="btn btn-secondary"
        >
          <span aria-live="polite">
            {loading ? ANALYSIS_STAGES[stageIndex] : "Run bundled sample"}
          </span>
        </button>
      </div>
    </form>
  );
}
