import fs from "fs";
import path from "path";
import { analyzeRepository } from "../index";
import { runIndexingPipeline } from "../pipeline";
import { runLanguagePacks } from "../languagePacks";
import { computeSetMetrics, edgeKey, hitRate } from "./metrics";
import type { EvalGold, FixtureEvalResult } from "./types";

const FIXTURES_ROOT = path.resolve(__dirname, "../../../fixtures");
const GOLD_ROOT = path.resolve(__dirname, "../../../eval/gold");

export function loadGoldLabels(): EvalGold[] {
  return fs
    .readdirSync(GOLD_ROOT)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const raw = fs.readFileSync(path.join(GOLD_ROOT, name), "utf-8");
      return JSON.parse(raw) as EvalGold;
    });
}

function packImports(
  packs: ReturnType<typeof runLanguagePacks>
): Array<{ from: string; to: string }> {
  const edges: Array<{ from: string; to: string }> = [];
  for (const pack of [packs.tsjs, packs.python, packs.java]) {
    if (!pack?.imports) continue;
    for (const [from, targets] of pack.imports) {
      for (const to of targets) {
        edges.push({ from, to });
      }
    }
  }
  return edges;
}

function packEntrypoints(packs: ReturnType<typeof runLanguagePacks>): string[] {
  const entrypoints = new Set<string>();
  for (const pack of [packs.tsjs, packs.python, packs.java]) {
    if (!pack?.entrypoints) continue;
    for (const entry of pack.entrypoints) entrypoints.add(entry);
  }
  return [...entrypoints];
}

export async function evaluateFixture(gold: EvalGold): Promise<FixtureEvalResult> {
  const fixturePath = path.join(FIXTURES_ROOT, gold.fixture);
  const pipeline = await runIndexingPipeline(fixturePath);
  const packs = runLanguagePacks(
    fixturePath,
    pipeline,
    Array.from(pipeline.file_metadata.keys())
  );
  const report = (
    await analyzeRepository({ zipRef: fixturePath }, { persist: false })
  ).report;

  const predictedEdges = packImports(packs).map((edge) => edgeKey(edge.from, edge.to));
  const expectedEdges = gold.internal_edges.map((edge) => edgeKey(edge.from, edge.to));
  const predictedCommands = report.run_commands.map((item) => item.command);
  const startHereTop = report.start_here.slice(0, 8).map((item) => item.path);
  const dangerTop = report.danger_zones.slice(0, 5).map((item) => item.path);
  const couplingPool = new Set([...dangerTop, ...startHereTop]);

  return {
    fixture: gold.fixture,
    entrypoints: computeSetMetrics(packEntrypoints(packs), gold.entrypoints),
    internal_edges: computeSetMetrics(predictedEdges, expectedEdges),
    run_commands: computeSetMetrics(predictedCommands, gold.run_commands),
    onboarding_hit_rate: hitRate(startHereTop, gold.onboarding_files),
    high_coupling_hit_rate: hitRate(couplingPool, gold.high_coupling_files),
    known_gaps: gold.known_gaps ?? [],
  };
}
