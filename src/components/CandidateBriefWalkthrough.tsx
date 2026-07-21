"use client";

import { CopyButton } from "@/components/CopyButton";
import { captureWalkthroughCopied, type ReportVariant } from "@/lib/productAnalytics";
import type { CandidateBrief } from "@/types/report";

interface CandidateBriefWalkthroughProps {
  walkthrough: NonNullable<CandidateBrief["walkthrough_script"]>;
  reportVariant: ReportVariant;
}

export function CandidateBriefWalkthrough({
  walkthrough,
  reportVariant,
}: CandidateBriefWalkthroughProps) {
  return (
    <section
      data-testid="walkthrough-script"
      className="overflow-hidden rounded-xl border border-emerald-200 bg-white"
    >
      <div className="border-b border-emerald-200 bg-emerald-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Start here
        </p>
        <h3 className="mt-1 text-base font-semibold text-slate-900">Walkthrough Script</h3>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
          Start with the version that fits the time you have, then use the evidence-backed
          sections below for follow-up questions.
        </p>
      </div>
      <div className="p-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <article
            data-testid="walkthrough-30-second"
            className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-slate-900">30-second</h4>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Use this for a quick introduction or a direct “what does this repository do?”
                  prompt.
                </p>
              </div>
              <div className="shrink-0">
                <CopyButton
                  text={walkthrough.thirty_second}
                  label="Copy 30s"
                  onCopySuccess={() => captureWalkthroughCopied(reportVariant, "30_second")}
                />
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{walkthrough.thirty_second}</p>
          </article>
          <article
            data-testid="walkthrough-2-minute"
            className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-slate-900">2-minute</h4>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Use this when you have time to explain the reading path, architecture, and risk
                  signals.
                </p>
              </div>
              <div className="shrink-0">
                <CopyButton
                  text={walkthrough.two_minute}
                  label="Copy 2min"
                  onCopySuccess={() => captureWalkthroughCopied(reportVariant, "2_minute")}
                />
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{walkthrough.two_minute}</p>
          </article>
        </div>
      </div>
    </section>
  );
}
