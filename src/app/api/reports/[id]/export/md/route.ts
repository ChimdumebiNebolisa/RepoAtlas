import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { ERROR_CODES, toApiErrorPayload } from "@/lib/errors";
import { exportReportToMarkdown } from "@/lib/export";
import { buildExportFilename } from "@/lib/exportNames";
import { reportExportErrorLogPayload } from "@/lib/failureDiagnostics";
import { isValidReportId } from "@/lib/reportId";
import { getReport } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = randomUUID();
  const { id: rawId } = await context.params;
  const id = rawId?.trim() ?? "";

  if (!isValidReportId(id)) {
    return NextResponse.json(
      {
        code: ERROR_CODES.INVALID_INPUT,
        message: "Invalid report id.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const report = await getReport(id);

    if (!report) {
      return NextResponse.json(
        {
          code: "NOT_FOUND",
          message: "Report not found.",
        },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const markdown = exportReportToMarkdown(report);
    const filename = buildExportFilename({
      repoName: report.repo_metadata.name,
      analyzedAt: report.repo_metadata.analyzed_at,
      ext: "md",
    });

    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(JSON.stringify(reportExportErrorLogPayload(requestId, err)));
    const { status, code, message } = toApiErrorPayload(err);
    return NextResponse.json(
      { code, message, requestId },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
