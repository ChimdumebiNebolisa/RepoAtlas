import path from "path";
import type { IndexingPipelineResult } from "../pipeline";
import { shouldSkipPath } from "../ignoreRules";
import {
  JAVA_EXTENSION,
  normalizeJavaPath,
  packageNameFromSource,
  readJavaSource,
  stripJavaCommentsAndLiterals,
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
  /public\s+static\s+void\s+main\s*\(\s*String\s*(?:\[\s*\]|\.\.\.)\s+\w+\s*\)/;
const SPRING_BOOT_APP_RE = /@SpringBootApplication/;
const SPRING_RUN_RE = /SpringApplication\.run\s*\(/;
const SPRING_CONTROLLER_RE = /@(RestController|Controller)\b/;
const REQUEST_MAPPING_RE = /@RequestMapping\b/;
const JAXRS_RE = /@(Path|GET|POST|PUT|DELETE|PATCH)\b/;
const JAXRS_IMPORT_RE =
  /^\s*import\s+(?:javax|jakarta)\.ws\.rs\.(\*|Path|GET|POST|PUT|DELETE|PATCH)\s*;/gm;

function hasImportedJaxRsAnnotation(code: string): boolean {
  const imports = new Set(
    [...code.matchAll(JAXRS_IMPORT_RE)].map((match) => match[1])
  );
  if (imports.has("*")) return JAXRS_RE.test(code);
  return [...code.matchAll(/@(Path|GET|POST|PUT|DELETE|PATCH)\b/g)].some(
    (match) => imports.has(match[1])
  );
}

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
    const code = stripJavaCommentsAndLiterals(content);
    if (
      SPRING_BOOT_APP_RE.test(code) ||
      SPRING_RUN_RE.test(code) ||
      SPRING_CONTROLLER_RE.test(code) ||
      REQUEST_MAPPING_RE.test(code) ||
      hasImportedJaxRsAnnotation(code)
    ) {
      entrypoints.add(filePath);
    } else if (MAIN_METHOD_RE.test(code)) {
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
