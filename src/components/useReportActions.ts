"use client";

import type { Report } from "@/types/report";
import type { ReportVariant } from "@/lib/productAnalytics";
import type { ReportActionsState } from "./reportActionState";
import { usePrivateReportSharing } from "./usePrivateReportSharing";
import { useReportFormatExports } from "./useReportFormatExports";

export function useReportActions({
  report,
  reportId,
  variant,
}: {
  report: Report;
  reportId?: string | null;
  variant: ReportVariant;
}): ReportActionsState {
  const formatExports = useReportFormatExports({ report, reportId, variant });
  const privateSharing = usePrivateReportSharing({ report, reportId, variant });
  return { ...formatExports, ...privateSharing };
}
