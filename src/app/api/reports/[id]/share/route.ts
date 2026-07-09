import { NextResponse } from "next/server";

import { ERROR_CODES, toApiErrorPayload } from "@/lib/errors";
import { createShareLink } from "@/lib/sharing";
import { getReport } from "@/lib/storage";

const UUID_LIKE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidReportId(id: string): boolean {
  const normalized = id.trim();
  return normalized.length > 0 && UUID_LIKE_PATTERN.test(normalized);
}

export async function POST(
  _request: Request,
  context: { params: { id: string } }
) {
  const id = context.params?.id?.trim() ?? "";

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
