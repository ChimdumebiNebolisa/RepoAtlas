"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!token) {
      setError("Missing share token.");
      setLoading(false);
      return;
    }

    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/share/${token}`);
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) {
          setError(data.message ?? "Share link expired or not found.");
          return;
        }
        setReport(data.report as Report);
        setExpiresAt(data.share?.expiresAt ?? null);
      } catch {
        if (alive) setError("Failed to load shared report.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <main className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-4 py-8 sm:px-6">
        <header className="mb-6 space-y-1">
          <p className="text-xl font-bold text-slate-900">RepoAtlas</p>
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
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {report && (
          <ReportTabs report={report} variant="preview" initialDemoMode />
        )}
      </div>
    </main>
  );
}
