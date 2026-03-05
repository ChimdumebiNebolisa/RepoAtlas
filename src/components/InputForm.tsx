"use client";

import { useState, useRef } from "react";
import type { Report } from "@/types/report";

interface InputFormProps {
  onAnalyzeStart: () => void;
  onAnalyzeComplete: (report: Report, reportId: string) => void;
  onAnalyzeError: (message: string) => void;
  loading: boolean;
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
        onAnalyzeError(data.message || data.code || "Analysis failed");
        return;
      }

      const { reportId } = data;
      if (!reportId) {
        onAnalyzeError("Invalid response: missing reportId");
        return;
      }

      const reportRes = await fetch(`/api/reports/${reportId}`);
      if (!reportRes.ok) {
        onAnalyzeError("Could not fetch report");
        return;
      }

      const report: Report = await reportRes.json();
      onAnalyzeComplete(report, reportId);
    } catch {
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
        <input
          ref={inputRef}
          id="zipFile"
          type="file"
          accept=".zip"
          onChange={handleFileChange}
          className="field-input block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:hover:bg-emerald-700"
          disabled={loading}
        />
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
