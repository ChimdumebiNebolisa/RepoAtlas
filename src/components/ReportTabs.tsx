"use client";

import { useState } from "react";
import type { Report } from "@/types/report";
import { FolderMapTree } from "./FolderMapTree";
import { ArchitectureGraph } from "./ArchitectureGraph";
import { StartHereTable } from "./StartHereTable";
import { DangerZonesTable } from "./DangerZonesTable";
import { RunContributeSection } from "./RunContributeSection";

const TABS = [
  "Overview",
  "Folder Map",
  "Architecture Map",
  "Start Here",
  "Danger Zones",
  "Run & Contribute",
] as const;

interface ReportTabsProps {
  report: Report;
  reportId: string;
}

export function ReportTabs({ report, reportId }: ReportTabsProps) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Overview");

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex-1" />
        <a
          href={`/api/reports/${reportId}/export/md`}
          download={`repo-brief-${reportId}.md`}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
        >
          Export Markdown
        </a>
      </div>
      <div className="border-b dark:border-gray-700 mb-4">
        <nav className="flex gap-4 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 whitespace-nowrap ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="py-4">
        {activeTab === "Overview" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Repository</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-2">
              <dt className="font-medium">Name:</dt>
              <dd>{report.repo_metadata.name}</dd>
              <dt className="font-medium">URL:</dt>
              <dd>
                <a
                  href={report.repo_metadata.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {report.repo_metadata.url}
                </a>
              </dd>
              <dt className="font-medium">Branch:</dt>
              <dd>{report.repo_metadata.branch}</dd>
              <dt className="font-medium">Analyzed:</dt>
              <dd>{report.repo_metadata.analyzed_at}</dd>
            </dl>
            {report.run_commands.length > 0 && (
              <div>
                <h3 className="font-semibold mt-4">Run commands</h3>
                <ul className="list-disc list-inside">
                  {report.run_commands.map((cmd, i) => (
                    <li key={i}>
                      <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                        {cmd.command}
                      </code>
                      {cmd.description && ` - ${cmd.description}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === "Folder Map" && (
          <FolderMapTree node={report.folder_map} />
        )}

        {activeTab === "Architecture Map" && (
          <ArchitectureGraph architecture={report.architecture} />
        )}

        {activeTab === "Start Here" && (
          <StartHereTable items={report.start_here} />
        )}

        {activeTab === "Danger Zones" && (
          <DangerZonesTable items={report.danger_zones} />
        )}

        {activeTab === "Run & Contribute" && (
          <RunContributeSection
            runCommands={report.run_commands}
            contributeSignals={report.contribute_signals}
          />
        )}
      </div>
    </div>
  );
}
