import { NextResponse } from "next/server";
import { getReport } from "@/lib/storage";

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

  return NextResponse.json(report);
}
