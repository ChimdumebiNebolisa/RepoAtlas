"use client";

import { useEffect, useState } from "react";
import type { Report } from "@/types/report";

interface InputFormProps {
  onAnalyzeStart: () => void;
  onAnalyzeComplete: (report: Report, reportId: string) => void;
  onAnalyzeError: (message: string) => void;
  loading: boolean;
  prefillUrl?: string;
}

export function InputForm({
  onAnalyzeStart,
  onAnalyzeComplete,
  onAnalyzeError,
  loading,
  prefillUrl,
}: InputFormProps) {
  const [githubUrl, setGithubUrl] = useState("");

  useEffect(() => {
    const incoming = prefillUrl?.trim() ?? "";
    if (!incoming || loading) return;
    if (incoming !== githubUrl) {
      setGithubUrl(incoming);
    }
  }, [prefillUrl, loading, githubUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim() || loading) return;

    onAnalyzeStart();

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl: githubUrl.trim() }),
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="githubUrl" className="mb-2 block text-sm font-medium text-slate-800">
          GitHub URL (public repos)
        </label>
        <input
          id="githubUrl"
          type="url"
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="field-input"
          disabled={loading}
        />
      </div>
      <button
        type="submit"
        disabled={loading || !githubUrl.trim()}
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
