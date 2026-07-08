/**
 * Report JSON schema and TypeScript types for RepoAtlas.
 * See docs/spec.md Section 7 (Data Models).
 */

export interface RepoMetadata {
  name: string;
  url: string;
  branch: string;
  /** Commit SHA of the analyzed branch (historically clone_hash). */
  clone_hash: string | null;
  analyzed_at: string; // ISO 8601
}

export type FolderMapNode = {
  path: string;
  type: "file" | "dir";
  children?: FolderMapNode[];
};

export interface ArchitectureNode {
  id: string; // file path or module id
  label: string; // display name
  type?: "file" | "module" | "folder";
}

export interface ArchitectureEdge {
  from: string; // node id
  to: string; // node id
  type?: "import" | "dependency";
}

export interface Architecture {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}

export interface StartHereItem {
  path: string;
  score: number;
  explanation: string;
}

export interface DangerZoneItem {
  path: string;
  score: number;
  breakdown: string;
  metrics: {
    size?: number;
    fan_in?: number;
    fan_out?: number;
    complexity?: number;
    test_proximity?: number;
  };
}

export interface RunCommand {
  source: string; // e.g. "package.json", "README"
  command: string;
  description?: string;
}

export interface ContributeSignals {
  key_docs: string[];
  ci_configs: string[];
}

export interface EvidenceRef {
  id: string;
  kind:
    | "file"
    | "folder"
    | "command"
    | "doc"
    | "ci"
    | "architecture"
    | "start_here"
    | "danger_zone"
    | "warning";
  label: string;
  path?: string;
  command?: string;
  detail?: string;
}

export interface BriefAnswer {
  answer: string;
  bullets: string[];
  evidence_refs: string[];
  confidence: "high" | "medium" | "low";
}

export interface CandidateBrief {
  repo_summary: {
    headline: string;
    plain_english: string;
    primary_evidence: string[];
    confidence: "high" | "medium" | "low";
  };

  reading_path: Array<{
    order: number;
    title: string;
    path: string;
    why: string;
    evidence_refs: string[];
  }>;

  interview_talking_points: {
    walk_me_through_codebase: BriefAnswer;
    riskiest_areas: BriefAnswer;
    improve_first: BriefAnswer;
    first_week_contribution: BriefAnswer;
  };

  first_pr_plan: Array<{
    title: string;
    rationale: string;
    suggested_files: string[];
    evidence_refs: string[];
    risk: "low" | "medium" | "high";
  }>;

  resume_bullets: Array<{
    audience: "resume" | "linkedin";
    text: string;
    evidence_refs: string[];
  }>;

  evidence_refs: EvidenceRef[];

  warnings: Array<{
    message: string;
    evidence_refs?: string[];
  }>;
}

export interface Report {
  repo_metadata: RepoMetadata;
  folder_map: FolderMapNode;
  architecture: Architecture;
  start_here: StartHereItem[];
  danger_zones: DangerZoneItem[];
  run_commands: RunCommand[];
  contribute_signals: ContributeSignals;
  candidate_brief?: CandidateBrief;
  warnings: string[];
}
