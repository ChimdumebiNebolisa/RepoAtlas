import type { Architecture } from "@/types/report";
import {
  ArchitectureEvidenceLists,
  getTextRelationships,
} from "./ArchitectureGraphEvidence";

const LAYOUT_FAILURE_HEADING = "The visual map could not be arranged.";
const LAYOUT_FAILURE_DETAIL =
  "The same repository evidence remains available as text below.";

export function ArchitectureGraphEmpty({
  architecture,
}: {
  architecture: Architecture;
}) {
  return (
    <div
      data-architecture-state="empty"
      className="max-w-2xl rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
    >
      <p className="font-medium text-slate-900">No dependency map was produced.</p>
      <p className="mt-1 text-sm leading-6 text-slate-700">
        RepoAtlas found {architecture.nodes.length} graph nodes and{" "}
        {architecture.edges.length} graph edges from supported dependency analysis. This does
        not prove that the repository has no architecture.
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Use Folder Map and Start Here to inspect the repository structure. Check Candidate Brief
        confidence notes for analysis limits.
      </p>
    </div>
  );
}

export function ArchitectureGraphFailure({
  architecture,
  boundedArchitecture,
  idPrefix,
}: {
  architecture: Architecture;
  boundedArchitecture: Architecture;
  idPrefix: string;
}) {
  const fallbackRelationships = getTextRelationships(
    boundedArchitecture.nodes,
    boundedArchitecture.edges
  );

  return (
    <div
      data-architecture-state="error"
      className="rounded border border-amber-200 bg-amber-50 p-4"
    >
      <div role="alert" aria-atomic="true">
        <p className="font-medium text-amber-950">{LAYOUT_FAILURE_HEADING}</p>
        <p className="mt-1 text-sm leading-6 text-amber-900">
          {LAYOUT_FAILURE_DETAIL}
        </p>
      </div>
      <div className="mt-4 rounded border border-amber-200 bg-white px-3 py-3">
        <p className="text-sm leading-6 text-slate-700">
          This text fallback preserves the repository nodes and supported
          relationships supplied to the visual map.
        </p>
        {architecture.nodes.length > boundedArchitecture.nodes.length && (
          <p className="mt-3 rounded bg-slate-100 px-3 py-2 text-xs leading-5 text-slate-600">
            The text fallback contains {boundedArchitecture.nodes.length} of{" "}
            {architecture.nodes.length} repository nodes.
          </p>
        )}
        <div className="mt-4">
          <ArchitectureEvidenceLists
            idPrefix={idPrefix}
            nodes={boundedArchitecture.nodes}
            relationships={fallbackRelationships}
            nodeHeading="Available nodes"
            relationshipHeading="Available relationships"
            emptyRelationshipCopy="No supported relationships connect these nodes."
          />
        </div>
      </div>
    </div>
  );
}

export function ArchitectureGraphLoading() {
  return (
    <p data-architecture-state="loading" className="text-gray-500">
      Computing layout...
    </p>
  );
}
