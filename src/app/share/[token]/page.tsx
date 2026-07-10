"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ReportTabs } from "@/components/ReportTabs";
import type { Report } from "@/types/report";

export default function TokenSharePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const [report, setReport] = useState<Report | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const loadReport = useCallback(async (signal: AbortSignal) => {
    if (!token) {
      setError("Missing share token.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const res = await fetch(`/api/share/${token}`, { signal });
      const data = await res.json().catch(() => ({}));
      if (signal.aborted) return;
      if (!res.ok) {
        setError(data.message ?? "Share link expired or not found.");
        return;
      }
      setReport(data.report as Report);
      setExpiresAt(data.share?.expiresAt ?? null);
    } catch (err) {
      if (signal.aborted) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Failed to load shared report.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    void loadReport(controller.signal);
    return () => controller.abort();
  }, [loadReport, retryCount]);

  const handleRetry = () => setRetryCount((count) => count + 1);

  return (
    <main className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-4 py-8 sm:px-6">
        <header className="mb-6 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xl font-bold text-slate-900">RepoAtlas</p>
            <Link
              href="/"
              className="text-sm font-medium text-emerald-700 hover:underline"
            >
              ← Back to home
            </Link>
          </div>
          <p className="text-sm text-slate-600">
            Shared Candidate Brief — read-only, token-gated view (report JSON only)
          </p>
          {expiresAt && (
            <p className="text-xs text-slate-500">
              Link expires {new Date(expiresAt).toLocaleString()}
            </p>
          )}
        </header>

        {loading && <p className="text-sm text-slate-600">Loading report…</p>}
        {error && (
          <div className="space-y-3">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="report-action report-action-secondary report-action-compact"
            >
              Retry
            </button>
          </div>
        )}
        {report && <ReportTabs report={report} variant="shared" />}
      </div>
    </main>
  );
}
