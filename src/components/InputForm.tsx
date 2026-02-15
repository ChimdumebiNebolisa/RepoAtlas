"use client";

import { useState } from "react";
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
  const [githubUrl, setGithubUrl] = useState("");

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
          GitHub repository URL
        </label>
        <input
          id="githubUrl"
          type="url"
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="w-full px-4 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
          disabled={loading}
        />
      </div>
      <button
        type="submit"
        disabled={loading || !githubUrl.trim()}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Analyzing..." : "Analyze"}
      </button>
    </form>
  );
}
