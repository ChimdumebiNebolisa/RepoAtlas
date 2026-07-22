/**
 * Analyzer evaluation gold labels and metrics.
 * Human-labeled expectations for fixture repositories — not analyzer output dumps.
 */

export interface EvalEdge {
  from: string;
  to: string;
}

export interface EvalUnresolved {
  from: string;
  specifier: string;
}

export interface EvalGold {
  fixture: string;
  /** Files that should be detected as application entrypoints. */
  entrypoints: string[];
  /** Expected resolved internal dependency edges (file → file). */
  internal_edges: EvalEdge[];
  /** Expected run/test/install commands (exact match against report.run_commands). */
  run_commands: string[];
  /** Files a human onboarding path should surface near the top of Start Here. */
  onboarding_files: string[];
  /** Files expected among high fan-in / Danger Zone hotspots. */
  high_coupling_files: string[];
  /** Specifiers that should remain unresolved (empty when none expected). */
  unresolved_imports: EvalUnresolved[];
  /** Documented accuracy gaps the suite tracks but does not hard-fail on. */
  known_gaps?: string[];
}

export interface SetMetrics {
  precision: number;
  recall: number;
  f1: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
}

export interface FixtureEvalResult {
  fixture: string;
  entrypoints: SetMetrics;
  internal_edges: SetMetrics;
  run_commands: SetMetrics;
  onboarding_hit_rate: number;
  high_coupling_hit_rate: number;
  known_gaps: string[];
}
