import path from "path";
import type { IndexingPipelineResult } from "../pipeline";
import { shouldSkipPath } from "../ignoreRules";
import {
  JAVA_EXTENSION,
  normalizeJavaPath,
  packageNameFromSource,
  readJavaSource,
} from "./javaShared";

const TEST_NAME_PATTERNS = [
  /Test\.java$/,
  /IT\.java$/,
  /Tests\.java$/,
  /TestCase\.java$/,
];
const TEST_SOURCE_PATH_RE =
  /(^|\/)src\/(?:test|integrationtest|functionaltest|acceptancetest)\/java(\/|$)/i;

const MAIN_METHOD_RE =
  /public\s+static\s+void\s+main\s*\(\s*String\s*\[\s*\]\s+\w+\s*\)/;
const SPRING_BOOT_APP_RE = /@SpringBootApplication/;
const SPRING_RUN_RE = /SpringApplication\.run\s*\(/;
const SPRING_CONTROLLER_RE = /@(RestController|Controller)\b/;
const REQUEST_MAPPING_RE = /@RequestMapping\b/;
const JAXRS_RE = /@(Path|GET|POST|PUT|DELETE|PATCH)\b/;

export interface JavaSourceIndex {
  fqnToFile: Map<string, string>;
  packageToFiles: Map<string, string[]>;
  testFiles: Set<string>;
}

export function selectJavaSourceFiles(
  pipeline: IndexingPipelineResult
): string[] {
  return Array.from(pipeline.file_metadata.keys()).filter(
    (filePath) =>
      path.extname(filePath) === JAVA_EXTENSION && !shouldSkipPath(filePath)
  );
}

export function isJavaTestFile(filePath: string): boolean {
  const normalized = normalizeJavaPath(filePath);
  return (
    TEST_SOURCE_PATH_RE.test(normalized) ||
    TEST_NAME_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

export function buildJavaSourceIndex(
  files: string[],
  workspacePath: string
): JavaSourceIndex {
  const fqnToFile = new Map<string, string>();
  const packageToFiles = new Map<string, string[]>();
  const testFiles = new Set<string>();

  for (const filePath of files) {
    if (isJavaTestFile(filePath)) testFiles.add(filePath);
    const content = readJavaSource(workspacePath, filePath);
    if (content === null) continue;
    const packageName = packageNameFromSource(content);
    const baseName = path.basename(filePath, JAVA_EXTENSION);
    fqnToFile.set(packageName ? `${packageName}.${baseName}` : baseName, filePath);
    const packageFiles = packageToFiles.get(packageName) ?? [];
    packageFiles.push(filePath);
    packageToFiles.set(packageName, packageFiles);
  }

  return { fqnToFile, packageToFiles, testFiles };
}

export function detectJavaEntrypoints(
  files: string[],
  workspacePath: string
): { entrypoints: Set<string>; warnings: string[] } {
  const entrypoints = new Set<string>();
  const mainClasses: string[] = [];

  for (const filePath of files) {
    const content = readJavaSource(workspacePath, filePath);
    if (content === null) continue;
    if (
      SPRING_BOOT_APP_RE.test(content) ||
      SPRING_RUN_RE.test(content) ||
      SPRING_CONTROLLER_RE.test(content) ||
      REQUEST_MAPPING_RE.test(content) ||
      JAXRS_RE.test(content)
    ) {
      entrypoints.add(filePath);
    } else if (MAIN_METHOD_RE.test(content)) {
      mainClasses.push(filePath);
      entrypoints.add(filePath);
    }
  }

  const warnings =
    mainClasses.length > 1
      ? [
          `Multiple main() entrypoints detected: ${mainClasses.slice(0, 5).join(", ")}${mainClasses.length > 5 ? "..." : ""}`,
        ]
      : [];
  return { entrypoints, warnings };
}
