const SMALL_SAMPLE_FILE_COUNT = 5;

export function normalizeScores(values: number[]): number[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Equal raw scores must not all become 100. That overstates absolute rank.
  // Use a neutral mid-scale so ties stay ties without looking like a perfect score.
  if (max === min) return values.map(() => 50);
  return values.map((value) => Math.round(((value - min) / (max - min)) * 100));
}

function percentileRank(values: number[], value: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  let below = 0;
  let equal = 0;
  for (const entry of sorted) {
    if (entry < value) below += 1;
    else if (entry === value) equal += 1;
  }
  const rank = ((below + equal * 0.5) / sorted.length) * 100;
  return clampScore(rank);
}

/**
 * Absolute 0–100 scaling against the observed max (or a soft floor) so tiny
 * repositories do not turn one large-among-four file into an extreme spike.
 */
function absoluteRank(
  values: number[],
  value: number,
  absoluteFloor: number
): number {
  if (!values.length) return 0;
  const max = Math.max(...values, absoluteFloor);
  return clampScore((value / max) * 100);
}

export function blendedMetricRank(
  values: number[],
  value: number,
  sampleSize: number,
  absoluteFloor = 1
): number {
  const percentile = percentileRank(values, value);
  if (sampleSize >= SMALL_SAMPLE_FILE_COUNT) return percentile;
  const absolute = absoluteRank(values, value, absoluteFloor);
  const weight = sampleSize / SMALL_SAMPLE_FILE_COUNT;
  return weight * percentile + (1 - weight) * absolute;
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}
