import type { DangerZoneItem, StartHereItem } from "@/types/report";
import { MAX_DANGER_ZONE_ITEMS } from "@/lib/ingestLimits";
import { normalizeScores } from "./metrics";
import type { StartHereCandidate } from "./shared";

const MAX_START_HERE_ITEMS = 12;

export function rankStartHere(candidates: Iterable<StartHereCandidate>): StartHereItem[] {
  const ranked = Array.from(candidates)
    .filter((candidate) => candidate.rawScore > 0 && candidate.reasons.length > 0)
    .sort((left, right) => {
      if (right.rawScore !== left.rawScore) return right.rawScore - left.rawScore;
      return left.path.localeCompare(right.path);
    })
    .slice(0, MAX_START_HERE_ITEMS);

  const normalizedScores = normalizeScores(ranked.map((candidate) => candidate.rawScore));
  return ranked.map((candidate, index) => ({
    path: candidate.path,
    score: normalizedScores[index],
    explanation: candidate.reasons.join("; "),
  }));
}

export function rankDangerZones(items: DangerZoneItem[]): DangerZoneItem[] {
  return items
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.path.localeCompare(right.path);
    })
    .slice(0, MAX_DANGER_ZONE_ITEMS);
}
