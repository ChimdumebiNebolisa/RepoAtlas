import { reportPersistenceFailureLogPayload } from "@/lib/failureDiagnostics";
import { saveReport } from "@/lib/storage";
import type { Report } from "@/types/report";
import type { AnalyzeResult } from "./analysisTypes";

export async function finishReport(
  reportId: string,
  report: Report,
  persist: boolean,
  allowInlineFallback: boolean,
  requestId?: string
): Promise<AnalyzeResult> {
  if (!persist) return { reportId, report, persisted: false };

  try {
    await saveReport(reportId, report);
    return { reportId, report, persisted: true };
  } catch (error) {
    if (!allowInlineFallback) throw error;
    console.warn(JSON.stringify(reportPersistenceFailureLogPayload(requestId)));
    return { reportId, report, persisted: false };
  }
}
