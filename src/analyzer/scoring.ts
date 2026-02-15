/**
 * Start Here and Danger Zones scoring algorithms.
 */

import path from "path";
import type { StartHereItem, DangerZoneItem } from "@/types/report";
import type { IndexingPipelineResult } from "./pipeline";
import type { TsJsPackResult } from "./packs/tsjs";
import type { PythonPackResult } from "./packs/python";

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const PYTHON_EXTENSION = ".py";

interface StartHereCandidate {
  path: string;
  rawScore: number;
  reasons: string[];
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function addReason(candidate: StartHereCandidate, reason: string): void {
  if (!candidate.reasons.includes(reason)) {
    candidate.reasons.push(reason);
  }
}

function normalizeScores(values: number[]): number[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 100);
  return values.map((v) => Math.round(((v - min) / (max - min)) * 100));
}

function percentileRank(values: number[], value: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let below = 0;
  let equal = 0;
  for (const entry of sorted) {
    if (entry < value) below += 1;
    else if (entry === value) equal += 1;
  }
  const rank = ((below + equal * 0.5) / sorted.length) * 100;
  return Math.max(0, Math.min(100, rank));
}

function computeEntrypointDistance(
  entrypoints: Set<string>,
  imports: Map<string, Set<string>>
): Map<string, number> {
  const distance = new Map<string, number>();
  const queue: string[] = [];

  for (const ep of entrypoints) {
    distance.set(ep, 0);
    queue.push(ep);
  }

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    const currentDistance = distance.get(current) ?? 0;
    for (const to of imports.get(current) ?? []) {
      if (distance.has(to)) continue;
      distance.set(to, currentDistance + 1);
      queue.push(to);
    }
  }

  return distance;
}

export function computeStartHere(
  pipeline: IndexingPipelineResult,
  tsjs?: TsJsPackResult | null,
  python?: PythonPackResult | null
): StartHereItem[] {
  const candidates = new Map<string, StartHereCandidate>();
  const getCandidate = (filePath: string): StartHereCandidate => {
    const existing = candidates.get(filePath);
    if (existing) return existing;
    const created: StartHereCandidate = { path: filePath, rawScore: 0, reasons: [] };
    candidates.set(filePath, created);
    return created;
  };

  for (const doc of pipeline.key_docs) {
    const c = getCandidate(doc);
    const baseName = path.basename(doc).toLowerCase();
    const normalizedDoc = normalizePath(doc).toLowerCase();
    if (baseName === "readme.md" || baseName === "readme") {
      c.rawScore += 95;
      addReason(c, "root README documentation");
    } else if (baseName.startsWith("readme")) {
      c.rawScore += 80;
      addReason(c, "README documentation");
    } else if (baseName.startsWith("contributing")) {
      c.rawScore += 75;
      addReason(c, "contribution guide");
    } else {
      c.rawScore += 45;
      addReason(c, "key project documentation");
    }
    if (normalizedDoc.includes("/docs/")) {
      c.rawScore += 5;
      addReason(c, "project docs reference");
    }
  }

  if (tsjs) {
    const codeFiles = Array.from(pipeline.file_metadata.keys()).filter((f) =>
      CODE_EXTENSIONS.has(path.extname(f))
    );
    const entrypointDistance = computeEntrypointDistance(tsjs.entrypoints, tsjs.imports);

    for (const filePath of codeFiles) {
      const norm = normalizePath(filePath);
      const c = getCandidate(filePath);

      if (/\/app\/api\/.+\/route\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(norm)) {
        c.rawScore += 85;
        addReason(c, "Next.js route handler");
      } else if (/\/app\/page\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(norm)) {
        c.rawScore += 80;
        addReason(c, "Next.js page entry");
      } else if (/\/app\/layout\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(norm)) {
        c.rawScore += 75;
        addReason(c, "Next.js layout entry");
      } else if (/\/(router|routes)\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(norm)) {
        c.rawScore += 65;
        addReason(c, "router module");
      }

      const fanIn = tsjs.fanIn.get(filePath) ?? 0;
      if (fanIn > 0) {
        c.rawScore += Math.min(35, fanIn * 3);
        addReason(c, `imported by ${fanIn} files`);
      }

      const distance = entrypointDistance.get(filePath);
      if (distance !== undefined) {
        if (distance === 0) {
          c.rawScore += 90;
          addReason(c, "detected entrypoint");
        } else if (distance === 1) {
          c.rawScore += 35;
          addReason(c, "directly imported by an entrypoint");
        } else if (distance <= 3) {
          c.rawScore += 18 - distance * 4;
          addReason(c, `within ${distance} import hops of an entrypoint`);
        }
      }

      if (/\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(norm) || /\/__tests__\//i.test(norm)) {
        c.rawScore -= 40;
      }
    }
  }

  if (python) {
    const codeFiles = Array.from(pipeline.file_metadata.keys()).filter(
      (f) => path.extname(f) === PYTHON_EXTENSION
    );
    const entrypointDistance = computeEntrypointDistance(python.entrypoints, python.imports);

    for (const filePath of codeFiles) {
      const norm = normalizePath(filePath);
      const c = getCandidate(filePath);
      const baseName = path.basename(norm).toLowerCase();

      if (/__main__\.py$/i.test(norm)) {
        c.rawScore += 90;
        addReason(c, "runnable module (__main__.py)");
      } else if (/manage\.py$/i.test(norm)) {
        c.rawScore += 85;
        addReason(c, "Django management command");
      } else if (baseName === "main.py") {
        c.rawScore += 80;
        addReason(c, "common entry file");
      } else if (baseName === "app.py" || baseName === "server.py") {
        c.rawScore += 75;
        addReason(c, "application entry file");
      } else if (baseName === "cli.py") {
        c.rawScore += 70;
        addReason(c, "CLI entry file");
      } else if (/settings\.py$/i.test(norm)) {
        c.rawScore += 85;
        addReason(c, "Django settings module");
      } else if (/urls\.py$/i.test(norm)) {
        c.rawScore += 80;
        addReason(c, "Django routing configuration");
      }

      const fanIn = python.fanIn.get(filePath) ?? 0;
      if (fanIn > 0) {
        c.rawScore += Math.min(35, fanIn * 3);
        addReason(c, `imported by ${fanIn} modules`);
      }

      const distance = entrypointDistance.get(filePath);
      if (distance !== undefined) {
        if (distance === 0) {
          c.rawScore += 90;
          addReason(c, "detected entrypoint");
        } else if (distance === 1) {
          c.rawScore += 35;
          addReason(c, "directly imported by an entrypoint");
        } else if (distance <= 3) {
          c.rawScore += 18 - distance * 4;
          addReason(c, `within ${distance} import hops of an entrypoint`);
        }
      }

      if (/^test_.*\.py$/i.test(baseName) || /_test\.py$/i.test(norm) || /^tests?\//i.test(norm)) {
        c.rawScore -= 40;
      }
    }
  }

  const ranked = Array.from(candidates.values())
    .filter((c) => c.rawScore > 0 && c.reasons.length > 0)
    .sort((a, b) => {
      if (b.rawScore !== a.rawScore) return b.rawScore - a.rawScore;
      return a.path.localeCompare(b.path);
    })
    .slice(0, 12);

  const normalizedScores = normalizeScores(ranked.map((c) => c.rawScore));
  return ranked.map((c, index) => ({
    path: c.path,
    score: normalizedScores[index],
    explanation: c.reasons.join("; "),
  }));
}

export function computeDangerZones(
  pipeline: IndexingPipelineResult,
  tsjs?: TsJsPackResult | null,
  python?: PythonPackResult | null
): DangerZoneItem[] {
  const tsjsFiles = tsjs
    ? Array.from(pipeline.file_metadata.keys()).filter((f) =>
        CODE_EXTENSIONS.has(path.extname(f))
      )
    : [];
  const pythonFiles = python
    ? Array.from(pipeline.file_metadata.keys()).filter((f) => path.extname(f) === PYTHON_EXTENSION)
    : [];
  const files = [...tsjsFiles, ...pythonFiles];

  if (!files.length) return [];

  const pack = (f: string) =>
    path.extname(f) === PYTHON_EXTENSION ? python! : tsjs!;

  const sizeValues = files.map((f) => pipeline.file_metadata.get(f)?.size ?? 0);
  const fanInValues = files.map((f) => pack(f).fanIn.get(f) ?? 0);
  const fanOutValues = files.map((f) => pack(f).fanOut.get(f) ?? 0);
  const complexityValues = files.map((f) => pack(f).complexity.get(f) ?? 0);
  const testProximityValues = files.map((f) => pack(f).testProximity?.get(f) ?? 0);

  const items: DangerZoneItem[] = [];

  for (const f of files) {
    const size = pipeline.file_metadata.get(f)?.size ?? 0;
    const fanIn = pack(f).fanIn.get(f) ?? 0;
    const fanOut = pack(f).fanOut.get(f) ?? 0;
    const complexity = pack(f).complexity.get(f) ?? 0;
    const testProximity = pack(f).testProximity?.get(f) ?? 0;

    const sizeP = percentileRank(sizeValues, size);
    const fanInP = percentileRank(fanInValues, fanIn);
    const fanOutP = percentileRank(fanOutValues, fanOut);
    const complexityP = percentileRank(complexityValues, complexity);
    const weakTestP = 100 - percentileRank(testProximityValues, testProximity);

    const weightedRisk =
      0.2 * sizeP +
      0.25 * fanInP +
      0.2 * fanOutP +
      0.25 * complexityP +
      0.1 * weakTestP;
    const riskScore = Math.round(Math.max(0, Math.min(100, weightedRisk)));

    const parts: string[] = [
      `size p${Math.round(sizeP)} (bytes=${size})`,
      `fan-in p${Math.round(fanInP)} (${fanIn})`,
      `fan-out p${Math.round(fanOutP)} (${fanOut})`,
      `complexity p${Math.round(complexityP)} (${complexity})`,
      `test proximity ${testProximity}`,
    ];
    if (testProximity === 0) {
      parts.push("no nearby tests");
    } else if (testProximity < 80) {
      parts.push("low test proximity");
    }

    items.push({
      path: f,
      score: riskScore,
      breakdown: parts.join(", "),
      metrics: { size, fan_in: fanIn, fan_out: fanOut, complexity, test_proximity: testProximity },
    });
  }

  items.sort((a, b) => b.score - a.score);
  return items;
}
