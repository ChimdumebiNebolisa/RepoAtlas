import type { SetMetrics } from "./types";

function safeRatio(numerator: number, denominator: number): number {
  if (denominator === 0) return numerator === 0 ? 1 : 0;
  return numerator / denominator;
}

export function edgeKey(from: string, to: string): string {
  return `${from}\u0000${to}`;
}

export function computeSetMetrics(
  predicted: Iterable<string>,
  expected: Iterable<string>
): SetMetrics {
  const pred = new Set(predicted);
  const exp = new Set(expected);
  let truePositives = 0;
  for (const item of pred) {
    if (exp.has(item)) truePositives += 1;
  }
  const falsePositives = pred.size - truePositives;
  const falseNegatives = exp.size - truePositives;
  const precision = safeRatio(truePositives, pred.size);
  const recall = safeRatio(truePositives, exp.size);
  const f1 = safeRatio(2 * precision * recall, precision + recall);
  return {
    precision,
    recall,
    f1,
    true_positives: truePositives,
    false_positives: falsePositives,
    false_negatives: falseNegatives,
  };
}

export function hitRate(predicted: Iterable<string>, expected: Iterable<string>): number {
  const pred = new Set(predicted);
  const exp = [...new Set(expected)];
  if (exp.length === 0) return 1;
  let hits = 0;
  for (const item of exp) {
    if (pred.has(item)) hits += 1;
  }
  return hits / exp.length;
}
