import { NextResponse } from "next/server";
import { getReport } from "@/lib/storage";
import { exportReportToMarkdown } from "@/lib/export";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const report = await getReport(params.id);

  if (!report) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Report not found or expired" },
      { status: 404 }
    );
  }

  const markdown = exportReportToMarkdown(report);
  return new NextResponse(markdown, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="repo-brief-${params.id}.md"`,
    },
  });
}
