import type {
  Architecture,
  ArchitectureInsights,
  AnalysisIntent,
  CodeSymbol,
  CommitInsights,
  ContributeSignals,
  DangerZoneItem,
  DocumentInventory,
  EvidenceRef,
  ProjectProfile,
  ProjectPurpose,
  RunCommand,
  SemanticGraph,
  StartHereItem,
  TechnicalDecision,
  TestInventory,
} from "@/types/report";

export type Confidence = "high" | "medium" | "low";
export type PrRisk = "low" | "medium" | "high";

export interface BuildCandidateBriefInput {
  repoName: string;
  analysisIntent?: AnalysisIntent;
  startHere: StartHereItem[];
  dangerZones: DangerZoneItem[];
  runCommands: RunCommand[];
  contributeSignals: ContributeSignals;
  architecture: Architecture;
  semanticGraph?: SemanticGraph;
  warnings: string[];
  projectProfile?: ProjectProfile;
  projectPurpose?: ProjectPurpose;
  technicalDecisions?: TechnicalDecision[];
  technicalDecisionEvidence?: EvidenceRef[];
  testInventory?: TestInventory;
  commitInsights?: CommitInsights;
  architectureInsights?: ArchitectureInsights;
  symbols?: CodeSymbol[];
  workspacePath?: string;
  keyDocs?: string[];
  documentInventory?: DocumentInventory;
}

export interface EvidenceIndex {
  refs: EvidenceRef[];
  architectureRef: string;
  startHereRefs: Map<string, string>;
  dangerZoneRefs: Map<string, string>;
  commandRefs: Map<string, string>;
  docRefs: Map<string, string>;
  ciRefs: Map<string, string>;
  warningRefs: string[];
}

export interface PrIdea {
  title: string;
  rationale: string;
  suggested_files: string[];
  evidence_refs: string[];
  risk: PrRisk;
}
