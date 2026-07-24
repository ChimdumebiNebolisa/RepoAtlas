import fs from "fs";
import path from "path";
import type { DangerZoneItem, TestInventory } from "@/types/report";

const TEST_DIRECTORY_PATTERN = /^(?:tests?|__tests__)$/i;
const PYTHON_TEST_PREFIX_PATTERN = /(^|\/)test_(?=[^/]+\.py$)/i;
const PYTHON_TEST_SUFFIX_PATTERN = /_test(?=\.py$)/i;
const JAVASCRIPT_TEST_SUFFIX_PATTERN = /\.(?:test|spec)(?=\.[^/.]+$)/i;
const JAVA_TEST_SUFFIX_PATTERN = /(?:Tests?|TestCase|IT)(?=\.java$)/;
const PYTHON_PACKAGE_MARKER_PATTERN = /(^|\/)__init__\.py$/i;

function testedArea(filePath: string): string {
  return filePath
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => !TEST_DIRECTORY_PATTERN.test(segment))
    .join("/")
    .replace(PYTHON_TEST_PREFIX_PATTERN, "$1")
    .replace(PYTHON_TEST_SUFFIX_PATTERN, "")
    .replace(JAVASCRIPT_TEST_SUFFIX_PATTERN, "")
    .replace(JAVA_TEST_SUFFIX_PATTERN, "");
}

function isReportableTestFile(filePath: string): boolean {
  return !PYTHON_PACKAGE_MARKER_PATTERN.test(filePath.replaceAll("\\", "/"));
}

function readWorkspaceFile(workspacePath: string, fileName: string): string {
  try {
    return fs.readFileSync(path.join(workspacePath, fileName), "utf-8");
  } catch {
    return "";
  }
}

function hasDependency(content: string, dependency: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${dependency}([^a-z0-9]|$)`, "i").test(content);
}

export function buildTestInventory(input: {
  testFiles: Set<string>;
  dangerZones: DangerZoneItem[];
  frameworks: string[];
}): TestInventory {
  const reportableTestFiles = Array.from(input.testFiles).filter(isReportableTestFile);
  const test_file_count = reportableTestFiles.length;
  const tested_areas = reportableTestFiles
    .map(testedArea)
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
  if (deps.jest || deps["@jest/globals"]) frameworks.push("Jest");
  if (deps.mocha) frameworks.push("Mocha");
  const pythonManifests = [
    readWorkspaceFile(workspacePath, "pyproject.toml"),
    readWorkspaceFile(workspacePath, "requirements.txt"),
    readWorkspaceFile(workspacePath, "requirements-dev.txt"),
    readWorkspaceFile(workspacePath, "pytest.ini"),
  ].join("\n");
  if (deps.pytest || hasDependency(pythonManifests, "pytest")) frameworks.push("pytest");

  const javaManifests = [
    readWorkspaceFile(workspacePath, "pom.xml"),
    readWorkspaceFile(workspacePath, "build.gradle"),
    readWorkspaceFile(workspacePath, "build.gradle.kts"),
  ].join("\n");
  if (deps.junit || hasDependency(javaManifests, "junit")) frameworks.push("JUnit");
  return frameworks;
}
