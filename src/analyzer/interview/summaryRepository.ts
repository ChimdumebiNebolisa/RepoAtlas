import type { CandidateBrief } from "@/types/report";
import { confidenceFor, refValues } from "./evidence";
import type { BuildCandidateBriefInput, EvidenceIndex } from "./types";

export function buildRepoSummary(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): CandidateBrief["repo_summary"] {
  const confidence = confidenceFor(input);
  const topStart = input.startHere[0];
  const topRisk = input.dangerZones[0];
  const primaryEvidence = [
    ...(topStart ? [evidence.startHereRefs.get(topStart.path)] : []),
    ...(topRisk ? [evidence.dangerZoneRefs.get(topRisk.path)] : []),
    evidence.architectureRef,
    ...refValues(evidence.commandRefs, 1),
    ...refValues(evidence.docRefs, 1),
  ].filter((id): id is string => Boolean(id));

  const headline = input.projectProfile
    ? `${input.repoName} appears to be a ${input.projectProfile.label}`
    : topStart != null
      ? `${input.repoName} has a ranked reading path starting at ${topStart.path}`
      : `${input.repoName} has limited deterministic onboarding signals`;

  const projectPurpose = input.projectPurpose;
  const supportedPurpose =
    projectPurpose && evidence.refs.some((ref) => ref.path === projectPurpose.path)
      ? projectPurpose
      : undefined;
  const plainEnglish = supportedPurpose
    ? `${supportedPurpose.text} (extracted from ${supportedPurpose.path}). ` +
      `RepoAtlas also found ${input.startHere.length} reading candidates, ${input.dangerZones.length} risk-ranked files, and ${input.runCommands.length} run commands.`
    : `RepoAtlas found ${input.startHere.length} reading candidates, ` +
      `${input.dangerZones.length} risk-ranked files, ${input.runCommands.length} run commands, ` +
      `${input.contributeSignals.key_docs.length} key docs, and ${input.contributeSignals.ci_configs.length} CI configs. ` +
      "Use this brief to discuss the repository from observed files, commands, docs, architecture edges, and risk signals only.";

  return {
    headline,
    plain_english: plainEnglish,
    primary_evidence:
      primaryEvidence.length > 0 ? primaryEvidence : [evidence.architectureRef],
    confidence,
  };
}
