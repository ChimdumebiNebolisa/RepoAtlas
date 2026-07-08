import { NextResponse } from "next/server";

import { ERROR_CODES, toApiErrorPayload } from "@/lib/errors";
import { resolveShareToken } from "@/lib/sharing";
import { getReport } from "@/lib/storage";

export async function GET(
  _request: Request,
  context: { params: { token: string } }
) {
  const token = context.params?.token?.trim() ?? "";

  if (!token) {
    return NextResponse.json(
      { code: ERROR_CODES.INVALID_INPUT, message: "Invalid share token." },
      { status: 400 }
    );
  }

  try {
    const record = await resolveShareToken(token);
    if (!record) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Share link expired or not found." },
        { status: 404 }
      );
    }

    const report = await getReport(record.reportId);
    if (!report) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Report not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        report,
        share: {
          expiresAt: record.expiresAt,
          createdAt: record.createdAt,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    const { status, code, message } = toApiErrorPayload(err);
    return NextResponse.json({ code, message }, { status });
  }
}
