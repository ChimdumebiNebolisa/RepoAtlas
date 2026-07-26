import fs from "fs";
import path from "path";
import type { DangerZoneItem, TestInventory } from "@/types/report";
import {
  gradleDeclaresJUnit,
  pomDeclaresJUnit,
  pyprojectHasDependency,
  pytestIniDeclaresPytest,
  requirementsHasDependency,
} from "./dependencyEvidence";

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

function readWorkspaceFile(workspacePath: string, fileName: string): string | undefined {
  try {
    const workspaceRoot = fs.realpathSync(workspacePath);
    const candidate = path.join(workspaceRoot, fileName);
    const stats = fs.lstatSync(candidate);
    if (stats.isSymbolicLink() || !stats.isFile()) return undefined;
    return fs.readFileSync(candidate, "utf-8");
  } catch {
    return undefined;
  }
}

function pythonManifestDeclaresPytest(workspacePath: string): boolean {
  const pyproject = readWorkspaceFile(workspacePath, "pyproject.toml");
  if (pyproject && pyprojectHasDependency(pyproject, "pytest")) return true;

  for (const fileName of ["requirements.txt", "requirements-dev.txt"]) {
    const requirements = readWorkspaceFile(workspacePath, fileName);
    if (requirements && requirementsHasDependency(requirements, "pytest")) return true;
  }

  const pytestConfig = readWorkspaceFile(workspacePath, "pytest.ini");
  return pytestConfig ? pytestIniDeclaresPytest(pytestConfig) : false;
}

function javaManifestDeclaresJUnit(workspacePath: string): boolean {
  const pom = readWorkspaceFile(workspacePath, "pom.xml");
  if (pom && pomDeclaresJUnit(pom)) return true;

  for (const fileName of ["build.gradle", "build.gradle.kts"] as const) {
    const gradle = readWorkspaceFile(workspacePath, fileName);
    if (
      gradle &&
      gradleDeclaresJUnit(
        gradle,
        fileName === "build.gradle" ? "groovy" : "kotlin"
      )
    ) {
      return true;
    }
  }

  return false;
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
  if (deps.pytest || pythonManifestDeclaresPytest(workspacePath)) frameworks.push("pytest");
  if (deps.junit || javaManifestDeclaresJUnit(workspacePath)) frameworks.push("JUnit");
  return frameworks;
}
