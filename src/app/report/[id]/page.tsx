"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ReportTabs } from "@/components/ReportTabs";
import type { Report } from "@/types/report";

export default function SharedReportPage() {
  const params = useParams<{ id: string }>();
  const reportId = params?.id ?? "";
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(
    reportId ? null : "Missing report id."
  );
  const [loading, setLoading] = useState(Boolean(reportId));

  useEffect(() => {
    if (!reportId) return;

    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}`);
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) {
          setError(data.message ?? "Report not found.");
          return;
        }
        setReport(data as Report);
      } catch {
        if (alive) setError("Failed to load report.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [reportId]);

  return (
    <main className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-4 py-8 sm:px-6">
        <header className="mb-6 space-y-1">
          <p className="text-xl font-bold text-slate-900">RepoAtlas</p>
          <p className="text-sm text-slate-600">
            Shared Candidate Brief — legacy direct link (use token sharing from Overview when
            possible)
          </p>
        </header>

        {loading && <p className="text-sm text-slate-600">Loading report…</p>}
        {error && (
          <div className="space-y-3">
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </div>
            <Link
              href="/#analyze"
              className="report-action report-action-primary report-action-compact inline-flex"
            >
              Start a new analysis
            </Link>
          </div>
        )}
        {report && <ReportTabs report={report} reportId={reportId} variant="live" />}
      </div>
    </main>
  );
}
