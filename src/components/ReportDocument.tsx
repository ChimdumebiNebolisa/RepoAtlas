"use client";

import type { Report } from "@/types/report";
import { FolderMapTree } from "./FolderMapTree";
import { ArchitectureGraph } from "./ArchitectureGraph";
import { StartHereTable } from "./StartHereTable";
import { DangerZonesTable } from "./DangerZonesTable";
import { RunContributeSection } from "./RunContributeSection";

interface ReportDocumentProps {
  report: Report;
}

export function ReportDocument({ report }: ReportDocumentProps) {
  return (
    <article className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Repository</h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm text-slate-800">
          <dt className="font-medium text-slate-600">Name:</dt>
          <dd>{report.repo_metadata.name}</dd>
          <dt className="font-medium text-slate-600">URL:</dt>
          <dd>{report.repo_metadata.url}</dd>
          <dt className="font-medium text-slate-600">Branch:</dt>
          <dd>{report.repo_metadata.branch}</dd>
          <dt className="font-medium text-slate-600">Analyzed:</dt>
          <dd>{report.repo_metadata.analyzed_at}</dd>
        </dl>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Folder Map</h2>
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <FolderMapTree node={report.folder_map} defaultExpandDepth={4} />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Architecture Map</h2>
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <ArchitectureGraph architecture={report.architecture} />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Start Here</h2>
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <StartHereTable items={report.start_here} />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Danger Zones</h2>
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <DangerZonesTable items={report.danger_zones} />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Run & Contribute</h2>
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <RunContributeSection
            runCommands={report.run_commands}
            contributeSignals={report.contribute_signals}
          />
        </div>
      </section>
    </article>
  );
}
