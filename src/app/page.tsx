"use client";

import { useState } from "react";
import { InputForm } from "@/components/InputForm";
import { ReportTabs } from "@/components/ReportTabs";
import type { Report } from "@/types/report";

export default function Home() {
  const [report, setReport] = useState<Report | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyzeComplete = (reportData: Report, id: string) => {
    setReport(reportData);
    setReportId(id);
    setLoading(false);
    setError(null);
  };

  const handleAnalyzeStart = () => {
    setLoading(true);
    setError(null);
  };

  const handleAnalyzeError = (message: string) => {
    setError(message);
    setLoading(false);
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">RepoAtlas</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Generate a structured Repo Brief from any GitHub repository or zip
          upload.
        </p>

        <InputForm
          onAnalyzeStart={handleAnalyzeStart}
          onAnalyzeComplete={handleAnalyzeComplete}
          onAnalyzeError={handleAnalyzeError}
          loading={loading}
        />

        {error && (
          <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded">
            {error}
          </div>
        )}

        {report && reportId && (
          <ReportTabs report={report} reportId={reportId} />
        )}
      </div>
    </main>
  );
}
