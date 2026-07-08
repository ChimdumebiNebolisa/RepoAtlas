import type { DangerZoneItem, TestInventory } from "@/types/report";

export function buildTestInventory(input: {
  testFiles: Set<string>;
  dangerZones: DangerZoneItem[];
  frameworks: string[];
}): TestInventory {
  const test_file_count = input.testFiles.size;
  const tested_areas = Array.from(input.testFiles)
    .map((f) => f.replace(/(^|\/)test[s]?\/|\.(test|spec)\./i, ""))
    .slice(0, 10);

  const untested_high_risk_files = input.dangerZones
    .filter((dz) => (dz.metrics.test_proximity ?? 0) < 50)
    .slice(0, 5)
    .map((dz) => dz.path);

  const suggested_test_targets = untested_high_risk_files.slice(0, 3);

  return {
    test_file_count,
    frameworks: input.frameworks,
    tested_areas,
    untested_high_risk_files,
    suggested_test_targets,
    evidence_refs: [],
  };
}

export function detectTestFrameworks(workspacePath: string, deps: Record<string, string>): string[] {
  const frameworks: string[] = [];
  if (deps.vitest) frameworks.push("Vitest");
  if (deps.jest) frameworks.push("Jest");
  if (deps.mocha) frameworks.push("Mocha");
  if (deps.pytest) frameworks.push("pytest");
  if (deps.junit || deps["@jest/globals"]) frameworks.push("JUnit");
  return frameworks;
}
