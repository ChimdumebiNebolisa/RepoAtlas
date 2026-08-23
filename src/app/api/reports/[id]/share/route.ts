import { NextResponse } from "next/server";

import { ERROR_CODES, toApiErrorPayload } from "@/lib/errors";
import { isValidReportId } from "@/lib/reportId";
import { createShareLink } from "@/lib/sharing";
import { getReport } from "@/lib/storage";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await context.params;
  const id = rawId?.trim() ?? "";

  if (!isValidReportId(id)) {
    return NextResponse.json(
      { code: ERROR_CODES.INVALID_INPUT, message: "Invalid report id." },
      { status: 400 }
    );
  }

  try {
    const report = await getReport(id);
    if (!report) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Report not found." },
        { status: 404 }
      );
    }

    const share = await createShareLink(id);
    return NextResponse.json(
      {
        token: share.token,
        sharePath: share.sharePath,
        expiresAt: share.expiresAt,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Report not found." },
        { status: 404 }
      );
    }
    const { status, code, message } = toApiErrorPayload(err);
    return NextResponse.json({ code, message }, { status });
  }
}
