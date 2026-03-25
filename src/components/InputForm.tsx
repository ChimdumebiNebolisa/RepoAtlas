"use client";

import { useState, useRef } from "react";
import type { Report } from "@/types/report";
import { ERROR_CODES } from "@/lib/errors";

const FALLBACK_ANALYSIS_MESSAGE = "Analysis failed. Check server logs.";

interface InputFormProps {
  onAnalyzeStart: () => void;
  onAnalyzeComplete: (report: Report, reportId: string) => void;
  onAnalyzeError: (message: string) => void;
  loading: boolean;
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
}: InputFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="zipFile" className="mb-2 block text-sm font-medium text-slate-800">
          Repository zip file
        </label>
        <div className="relative flex min-h-[2.5rem] w-full items-stretch overflow-hidden rounded-[var(--radius-md)] border border-[#cbd5e1] bg-white focus-within:border-[#86efac] focus-within:outline-none focus-within:ring-2 focus-within:ring-emerald-500/30">
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
          <span className="flex min-h-[2.5rem] flex-1 items-center truncate pl-4 pr-3 text-sm text-slate-500">
            {file ? file.name : "No file chosen"}
          </span>
          <span className="flex min-h-[2.5rem] shrink-0 items-center border-l border-[#cbd5e1] bg-slate-100 px-4 text-sm font-medium text-slate-700">
            Choose file
          </span>
        </div>
      </div>
      <button
        type="submit"
        disabled={loading || !file}
        className="btn btn-primary w-full sm:w-auto"
      >
        {loading && (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
            aria-hidden="true"
          />
        )}
        {loading ? "Analyzing..." : "Analyze Repository"}
      </button>
    </form>
  );
}
