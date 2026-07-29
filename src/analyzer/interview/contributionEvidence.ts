import type { BuildCandidateBriefInput, EvidenceIndex } from "./types";

export function validEvidenceIds(evidence: EvidenceIndex): Set<string> {
  return new Set(evidence.refs.map((ref) => ref.id));
}

export function validMapEntries(
  map: Map<string, string>,
  evidence: EvidenceIndex
): Array<[string, string]> {
  const validIds = validEvidenceIds(evidence);
  return Array.from(map.entries()).filter(([, id]) => validIds.has(id));
}

export function evidenceBackedPaths(
  paths: string[],
  map: Map<string, string>,
  evidence: EvidenceIndex
): string[] {
  const validEntries = new Map(validMapEntries(map, evidence));
  return Array.from(new Set(paths)).filter((path) => validEntries.has(path));
}

export function evidenceBackedCommands(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): BuildCandidateBriefInput["runCommands"] {
  const validEntries = new Map(validMapEntries(evidence.commandRefs, evidence));
  const seenCommands = new Set<string>();
  return input.runCommands.filter((command) => {
    const key = `${command.source}:${command.command}`;
    if (!validEntries.has(key) || seenCommands.has(command.command)) return false;
    seenCommands.add(command.command);
    return true;
  });
}

export function evidenceRefsForKeys(
  keys: string[],
  map: Map<string, string>,
  evidence: EvidenceIndex,
  limit?: number
): string[] {
  const validEntries = new Map(validMapEntries(map, evidence));
  const refs = keys
    .map((key) => validEntries.get(key))
    .filter((ref): ref is string => Boolean(ref));
  return typeof limit === "number" ? refs.slice(0, limit) : refs;
}

export function validWarningRefs(evidence: EvidenceIndex): string[] {
  const validIds = validEvidenceIds(evidence);
  return evidence.warningRefs.filter((id) => validIds.has(id));
}
