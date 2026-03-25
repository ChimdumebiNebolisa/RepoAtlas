import { NextRequest, NextResponse } from "next/server";
import { exportReportToMarkdown } from "@/lib/export";
import { toApiErrorPayload } from "@/lib/errors";
import { getReport } from "@/lib/storage";

const REPORT_ID_REGEX = /^[A-Za-z0-9_-]+$/;

function isValidReportId(id: string): boolean {
  return REPORT_ID_REGEX.test(id);
}

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  const id = context.params.id;

  if (!isValidReportId(id)) {
    return NextResponse.json(
      {
        code: "INVALID_INPUT",
        message: "Invalid report id.",
      },
      { status: 400 }
    );
  }

  try {
    const report = await getReport(id);

    if (!report) {
      return NextResponse.json(
        {
          code: "REPORT_NOT_FOUND",
          message: "Report not found.",
        },
        { status: 404 }
      );
    }

    const markdown = exportReportToMarkdown(report);

    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"repo-brief-${id}.md\"`,
      },
    });
  } catch (err) {
    const { status, code, message } = toApiErrorPayload(err);
    return NextResponse.json({ code, message }, { status });
  }
}
