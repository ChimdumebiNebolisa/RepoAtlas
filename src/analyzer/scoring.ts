/**
 * Start Here and Danger Zones scoring algorithms.
 */

import path from "path";
import type { StartHereItem, DangerZoneItem } from "@/types/report";
import type { IndexingPipelineResult } from "./pipeline";
import type { TsJsPackResult } from "./packs/tsjs";

export function computeStartHere(
  pipeline: IndexingPipelineResult,
  tsjs?: TsJsPackResult | null
): StartHereItem[] {
  const items: StartHereItem[] = [];

  for (const doc of pipeline.key_docs) {
    let score = 30;
    let explanation = "Key documentation";
    if (doc.toLowerCase().startsWith("readme")) {
      score += 40;
      explanation = doc === "README.md" || doc === "README" ? "Root README" : "README";
    }
    if (doc.toLowerCase().startsWith("contributing")) {
      explanation = "Contribution guide";
    }
    items.push({ path: doc, score, explanation });
  }

  if (tsjs) {
    for (const ep of tsjs.entrypoints) {
      const fanIn = tsjs.fanIn.get(ep) ?? 0;
      const score = 50 + Math.min(20, fanIn);
      items.push({
        path: ep,
        score,
        explanation: ep.includes("index") ? "Module entrypoint (index file)" : "Main entrypoint",
      });
    }
  }

  items.sort((a, b) => b.score - a.score);

  const maxScore = Math.max(1, ...items.map((i) => i.score));
  return items.map((i) => ({
    ...i,
    score: Math.round((i.score / maxScore) * 100),
  }));
}

export function computeDangerZones(
  pipeline: IndexingPipelineResult,
  tsjs?: TsJsPackResult | null
): DangerZoneItem[] {
  if (!tsjs) return [];

  const codeExts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
  const files = Array.from(pipeline.file_metadata.keys()).filter((f) =>
    codeExts.some((e) => f.endsWith(e))
  );

  const sizeValues = files.map((f) => pipeline.file_metadata.get(f)?.size ?? 0);
  const fanInValues = files.map((f) => tsjs.fanIn.get(f) ?? 0);
  const fanOutValues = files.map((f) => tsjs.fanOut.get(f) ?? 0);
  const complexityValues = files.map((f) => tsjs.complexity.get(f) ?? 0);

  const percentile = (arr: number[], val: number) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = sorted.findIndex((x) => x >= val);
    if (idx < 0) return 100;
    return (idx / sorted.length) * 100;
  };

  const items: DangerZoneItem[] = [];

  for (const f of files) {
    const size = pipeline.file_metadata.get(f)?.size ?? 0;
    const fanIn = tsjs.fanIn.get(f) ?? 0;
    const fanOut = tsjs.fanOut.get(f) ?? 0;
    const complexity = tsjs.complexity.get(f) ?? 0;
    const hasNearbyTest = [...tsjs.testFiles].some(
      (t) => path.dirname(t) === path.dirname(f) || path.dirname(t) === path.dirname(path.dirname(f))
    );
    const testProximity = hasNearbyTest ? 100 : 0;

    const sizeP = percentile(sizeValues, size);
    const fanInP = percentile(fanInValues, fanIn);
    const fanOutP = percentile(fanOutValues, fanOut);
    const complexityP = percentile(complexityValues, complexity);

    const riskScore =
      0.2 * sizeP +
      0.25 * fanInP +
      0.2 * fanOutP +
      0.25 * complexityP +
      0.1 * (100 - testProximity);

    const parts: string[] = [];
    if (fanInP > 50) parts.push(`High fan-in (${fanIn})`);
    if (complexityP > 50) parts.push(`high complexity (${complexity})`);
    if (!hasNearbyTest) parts.push("no nearby tests");

    items.push({
      path: f,
      score: Math.min(100, Math.round(riskScore)),
      breakdown: parts.length ? parts.join(", ") : "Low risk",
      metrics: { size, fan_in: fanIn, fan_out: fanOut, complexity, test_proximity: testProximity },
    });
  }

  items.sort((a, b) => b.score - a.score);
  return items;
}
