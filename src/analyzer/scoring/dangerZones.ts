import path from "path";
import type { CommitInsights, DangerZoneItem } from "@/types/report";
import { churnScoreForFile } from "../gitHistory";
import type { IndexingPipelineResult } from "../pipeline";
import type { TsJsPackResult } from "../packs/tsjs";
import type { PythonPackResult } from "../packs/python";
import type { JavaPackResult } from "../packs/java";
import { blendedMetricRank, clampScore } from "./metrics";
import { rankDangerZones } from "./ranking";
import { CODE_EXTENSIONS, JAVA_EXTENSION, PYTHON_EXTENSION } from "./shared";

type LanguagePack = TsJsPackResult | PythonPackResult | JavaPackResult;

const SMALL_REPOSITORY_ABSOLUTE_FLOORS = {
  size: 1000,
  coupling: 5,
  complexity: 10,
  testProximity: 100,
  churn: 100,
} as const;

export function computeDangerZones(
  pipeline: IndexingPipelineResult,
  tsjs?: TsJsPackResult | null,
  python?: PythonPackResult | null,
  java?: JavaPackResult | null,
  commitInsights?: CommitInsights | null
): DangerZoneItem[] {
  // Test files are not production surface area. Excluding them also keeps them
  // from skewing the percentile baselines for the remaining files.
  const tsjsFiles = tsjs
    ? Array.from(pipeline.file_metadata.keys()).filter(
        (filePath) =>
          CODE_EXTENSIONS.has(path.extname(filePath)) && !tsjs.testFiles.has(filePath)
      )
    : [];
  const pythonFiles = python
    ? Array.from(pipeline.file_metadata.keys()).filter(
        (filePath) =>
          path.extname(filePath) === PYTHON_EXTENSION && !python.testFiles.has(filePath)
      )
    : [];
  const javaFiles = java
    ? Array.from(pipeline.file_metadata.keys()).filter(
        (filePath) =>
          path.extname(filePath) === JAVA_EXTENSION && !java.testFiles.has(filePath)
      )
    : [];
  const files = [...tsjsFiles, ...pythonFiles, ...javaFiles];

  if (!files.length) return [];

  const packFor = (filePath: string): LanguagePack =>
    path.extname(filePath) === JAVA_EXTENSION
      ? java!
      : path.extname(filePath) === PYTHON_EXTENSION
        ? python!
        : tsjs!;

  const sizeValues = files.map((filePath) => pipeline.file_metadata.get(filePath)?.size ?? 0);
  const fanInValues = files.map((filePath) => packFor(filePath).fanIn.get(filePath) ?? 0);
  const fanOutValues = files.map((filePath) => packFor(filePath).fanOut.get(filePath) ?? 0);
  const complexityValues = files.map(
    (filePath) => packFor(filePath).complexity.get(filePath) ?? 0
  );
  const testProximityValues = files.map(
    (filePath) => packFor(filePath).testProximity?.get(filePath) ?? 0
  );
  const churnValues = files.map((filePath) =>
    commitInsights ? churnScoreForFile(filePath, commitInsights) : 0
  );
  const hasChurn =
    commitInsights?.mode !== "unavailable" && churnValues.some((value) => value > 0);

  const items: DangerZoneItem[] = [];

  for (const filePath of files) {
    const pack = packFor(filePath);
    const size = pipeline.file_metadata.get(filePath)?.size ?? 0;
    const fanIn = pack.fanIn.get(filePath) ?? 0;
    const fanOut = pack.fanOut.get(filePath) ?? 0;
    const complexity = pack.complexity.get(filePath) ?? 0;
    const testProximity = pack.testProximity?.get(filePath) ?? 0;
    const churn = commitInsights ? churnScoreForFile(filePath, commitInsights) : 0;

    const sizeP = blendedMetricRank(
      sizeValues,
      size,
      files.length,
      SMALL_REPOSITORY_ABSOLUTE_FLOORS.size
    );
    const fanInP = blendedMetricRank(
      fanInValues,
      fanIn,
      files.length,
      SMALL_REPOSITORY_ABSOLUTE_FLOORS.coupling
    );
    const fanOutP = blendedMetricRank(
      fanOutValues,
      fanOut,
      files.length,
      SMALL_REPOSITORY_ABSOLUTE_FLOORS.coupling
    );
    const complexityP = blendedMetricRank(
      complexityValues,
      complexity,
      files.length,
      SMALL_REPOSITORY_ABSOLUTE_FLOORS.complexity
    );
    const weakTestP =
      100 -
      blendedMetricRank(
        testProximityValues,
        testProximity,
        files.length,
        SMALL_REPOSITORY_ABSOLUTE_FLOORS.testProximity
      );
    const churnP = hasChurn
      ? blendedMetricRank(
          churnValues,
          churn,
          files.length,
          SMALL_REPOSITORY_ABSOLUTE_FLOORS.churn
        )
      : 0;

    const weightedRisk = hasChurn
      ? 0.18 * sizeP +
        0.22 * fanInP +
        0.18 * fanOutP +
        0.22 * complexityP +
        0.1 * weakTestP +
        0.1 * churnP
      : 0.2 * sizeP +
        0.25 * fanInP +
        0.2 * fanOutP +
        0.25 * complexityP +
        0.1 * weakTestP;
    const riskScore = Math.round(clampScore(weightedRisk));

    const parts: string[] = [
      `size p${Math.round(sizeP)} (bytes=${size})`,
      `fan-in p${Math.round(fanInP)} (${fanIn})`,
      `fan-out p${Math.round(fanOutP)} (${fanOut})`,
      `complexity p${Math.round(complexityP)} (${complexity})`,
      `test proximity ${testProximity}`,
    ];
    if (hasChurn && churn > 0) {
      parts.push(`recent churn p${Math.round(churnP)}`);
    }
    if (testProximity === 0) {
      parts.push("no nearby tests");
    } else if (testProximity < 80) {
      parts.push("low test proximity");
    }

    items.push({
      path: filePath,
      score: riskScore,
      breakdown: parts.join(", "),
      metrics: {
        size,
        fan_in: fanIn,
        fan_out: fanOut,
        complexity,
        test_proximity: testProximity,
        ...(churn > 0 ? { churn } : {}),
      },
    });
  }

  return rankDangerZones(items);
}
