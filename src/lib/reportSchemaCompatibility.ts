import { ANALYSIS_INTENTS, REPORT_VERSION } from "@/types/report";
import { isNonNegativeInteger } from "./reportSchemaPrimitives";

export type CompatibilityFailure = "corrupt" | "incompatible";

export function reportCompatibilityFailure(
  data: Record<string, unknown>,
): CompatibilityFailure | null {
  const version = data.report_version;
  if (version != null) {
    if (!isNonNegativeInteger(version) || version === 0) {
      return "corrupt";
    }
    if (version > REPORT_VERSION) return "incompatible";
  }
  if (
    data.analysis_intent != null &&
    !ANALYSIS_INTENTS.some((intent) => intent === data.analysis_intent)
  ) {
    return "corrupt";
  }
  return null;
}
