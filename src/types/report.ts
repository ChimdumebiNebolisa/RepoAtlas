/**
 * Report JSON schema and TypeScript types for RepoAtlas.
 * See docs/spec.md Section 7 (Data Models).
 */

export const REPORT_VERSION = 2;

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
  id: string;
  label: string;
  type?: "file" | "module" | "folder";
}

export interface ArchitectureEdge {
  from: string;
  to: string;
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
    churn?: number;
  };
}

export interface RunCommand {
  source: string;
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
    | "warning"
    | "decision"
    | "symbol";
  label: string;
  path?: string;
  command?: string;
  detail?: string;
  line_start?: number;
  line_end?: number;
  snippet?: string;
}

export interface BriefAnswer {
  answer: string;
  bullets: string[];
  evidence_refs: string[];
  confidence: "high" | "medium" | "low";
}

export interface ProjectProfile {
  type: string;
  label: string;
  confidence: "high" | "medium" | "low";
  signals: string[];
  evidence_refs: string[];
}

export interface ProjectPurpose {
  text: string;
  source: "readme_heading" | "readme_intro" | "package.json" | "pyproject" | "app_metadata";
  path: string;
  extracted: true;
  evidence_refs: string[];
}

export interface TechnicalDecision {
  category: "framework" | "database" | "auth" | "deployment" | "testing" | "styling" | "storage";
  decision: string;
  signals: string[];
  evidence_refs: string[];
}

export interface ConfidenceAssessment {
  level: "high" | "medium" | "low";
  reasons: string[];
  gaps: string[];
}

export interface WalkthroughScript {
  thirty_second: string;
  two_minute: string;
  deep_technical: string;
  tradeoffs_to_mention: string[];
  improvements_next: string[];
  evidence_refs: string[];
}

export interface BehavioralHook {
  prompt: string;
  answer_starter: string;
  evidence_refs: string[];
  sufficient_evidence: boolean;
}

export interface InterviewQuestion {
  question: string;
  rationale: string;
  evidence_refs: string[];
}

export interface CodeSymbol {
  name: string;
  kind: "function" | "class" | "component" | "route" | "export";
  path: string;
  line?: number;
}

export interface TestInventory {
  test_file_count: number;
  frameworks: string[];
  tested_areas: string[];
  untested_high_risk_files: string[];
  suggested_test_targets: string[];
  evidence_refs: string[];
}

export interface ArchitectureInsights {
  layers: string[];
  violations: Array<{ from: string; to: string; reason: string }>;
  circular_deps: string[][];
  hubs: string[];
}

export interface CommitInsights {
  mode: "local_git" | "github_api" | "unavailable";
  recent_work_areas: string[];
  high_churn_files: string[];
  co_changed_pairs: Array<{ files: [string, string]; count: number }>;
  evidence_refs: string[];
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

  confidence_assessment?: ConfidenceAssessment;
  walkthrough_script?: WalkthroughScript;
  behavioral_hooks?: BehavioralHook[];
  interview_questions?: InterviewQuestion[];
}

export interface Report {
  report_version?: number;
  partial?: boolean;
  repo_metadata: RepoMetadata;
  folder_map: FolderMapNode;
  architecture: Architecture;
  start_here: StartHereItem[];
  danger_zones: DangerZoneItem[];
  run_commands: RunCommand[];
  contribute_signals: ContributeSignals;
  candidate_brief?: CandidateBrief;
  project_profile?: ProjectProfile;
  project_purpose?: ProjectPurpose;
  technical_decisions?: TechnicalDecision[];
  symbols?: CodeSymbol[];
  test_inventory?: TestInventory;
  architecture_insights?: ArchitectureInsights;
  commit_insights?: CommitInsights;
  warnings: string[];
}
