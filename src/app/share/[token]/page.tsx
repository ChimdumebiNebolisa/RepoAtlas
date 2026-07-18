"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ReportTabs } from "@/components/ReportTabs";
import type { Report } from "@/types/report";
import {
  openPortableShare,
  PORTABLE_SHARE_TOKEN,
  PortableShareError,
} from "@/lib/portableSharing";

export default function TokenSharePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const [report, setReport] = useState<Report | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    token ? null : "Missing share token."
  );
  const [loading, setLoading] = useState(Boolean(token));
  const [retryCount, setRetryCount] = useState(0);
  const portable = token === PORTABLE_SHARE_TOKEN;

  const loadReport = useCallback(async (signal: AbortSignal) => {
    if (!token) return;

    await Promise.resolve();
    if (signal.aborted) return;
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      if (portable) {
        const shared = await openPortableShare(window.location.hash);
        if (signal.aborted) return;
        setReport(shared.report);
        setExpiresAt(shared.expiresAt);
        return;
      }

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
      setError(
        err instanceof PortableShareError
          ? err.message
          : "Failed to load shared report."
      );
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [portable, token]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadReport(controller.signal));
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
            {portable
              ? "Shared Candidate Brief — read-only, private link decrypted in this browser"
              : "Shared Candidate Brief — read-only, token-gated view (report JSON only)"}
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
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
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
