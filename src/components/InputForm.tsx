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
        <label htmlFor="githubUrl" className="block text-sm font-medium mb-2">
          GitHub URL (public repos)
        </label>
        <input
          id="githubUrl"
          type="url"
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
          disabled={loading}
        />
      </div>
      <button
        type="submit"
        disabled={loading || !githubUrl.trim()}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-700 to-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition duration-200 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
