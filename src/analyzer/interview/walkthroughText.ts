import type { WalkthroughScript } from "@/types/report";
import { listPaths } from "./evidence";
import type { BuildCandidateBriefInput } from "./types";
import { concisePurpose, finishSentence } from "./walkthroughPurpose";

type WalkthroughText = Pick<
  WalkthroughScript,
  "thirty_second" | "two_minute" | "deep_technical"
>;

export function buildWalkthroughText(
  input: BuildCandidateBriefInput
): WalkthroughText {
  const profile = input.projectProfile?.label ?? "this codebase";
  const purpose = input.projectPurpose?.text;
  const purposeExcerpt = purpose ? concisePurpose(purpose) : "";
  const topPaths = input.startHere.slice(0, 3).map((item) => item.path);
  const commands = input.runCommands.slice(0, 2).map((item) => item.command);
  const symbolNames = (input.symbols ?? [])
    .slice(0, 5)
    .map((symbol) => symbol.name);

  const thirty_second =
    finishSentence(`${profile}${purposeExcerpt ? `: ${purposeExcerpt}` : ""}`) +
    `Start at ${topPaths[0] ?? "the folder map"}, validate with ${commands[0] ?? "detected project files"}.`;

  const two_minute =
    `${thirty_second} Review ${listPaths(topPaths, "ranked files")}, ` +
    `then discuss architecture (${input.architecture.nodes.length} nodes) and top risk file ` +
    `${input.dangerZones[0]?.path ?? "if present"}.`;

  const deep_technical =
    two_minute +
    (symbolNames.length ? ` Key surfaces include ${symbolNames.join(", ")}.` : "");

  return {
    thirty_second,
    two_minute,
    deep_technical,
  };
}
