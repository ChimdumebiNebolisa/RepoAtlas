import type { Report } from "@/types/report";
import { formatTimestamp, isHttpUrl, repoSourceLabel } from "@/lib/format";
import { DeepAnalysisSection } from "./DeepAnalysisSection";
import { DocumentsPanel } from "./DocumentsPanel";

export function ReportOverview({ report }: { report: Report }) {
  const analyzedAt = formatTimestamp(report.repo_metadata.analyzed_at);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Repository</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-2">
        <dt className="font-medium">Name:</dt>
        <dd>{report.repo_metadata.name}</dd>
        <dt className="font-medium">Source:</dt>
        <dd>
          {isHttpUrl(report.repo_metadata.url) ? (
            <a
              href={report.repo_metadata.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 hover:underline"
            >
              {report.repo_metadata.url}
            </a>
          ) : (
            <span>{repoSourceLabel(report.repo_metadata.url)}</span>
          )}
        </dd>
        <dt className="font-medium">Branch:</dt>
        <dd>{report.repo_metadata.branch}</dd>
        <dt className="font-medium">Analyzed:</dt>
        <dd>
          {analyzedAt.dateTime ? (
            <time dateTime={analyzedAt.dateTime}>{analyzedAt.display}</time>
          ) : (
            <span>{analyzedAt.display}</span>
          )}
        </dd>
        {report.partial && (
          <>
            <dt className="font-medium">Status:</dt>
            <dd className="text-amber-700">Partial report (analysis timed out)</dd>
          </>
        )}
      </dl>
      {report.document_inventory && (
        <div className="mt-6">
          <h3 className="mb-3 text-lg font-semibold text-slate-900">Documentation inventory</h3>
          <DocumentsPanel inventory={report.document_inventory} />
        </div>
      )}
      <div className="mt-6">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Deep analysis</h3>
        <DeepAnalysisSection
          projectProfile={report.project_profile}
          testInventory={report.test_inventory}
          architectureInsights={report.architecture_insights}
          commitInsights={report.commit_insights}
        />
      </div>
      {report.run_commands.length > 0 && (
        <div>
          <h3 className="mt-4 font-semibold">Run commands</h3>
          <ul className="list-inside list-disc">
            {report.run_commands.map((command, index) => (
              <li key={index}>
                <code className="rounded bg-gray-100 px-1 text-slate-900">{command.command}</code>
                {command.description && ` - ${command.description}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
