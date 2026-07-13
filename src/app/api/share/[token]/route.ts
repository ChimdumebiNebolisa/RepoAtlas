import { NextResponse } from "next/server";

import { ERROR_CODES, toApiErrorPayload } from "@/lib/errors";
import { resolveShareToken } from "@/lib/sharing";
import { getReport } from "@/lib/storage";

// Shared report payloads must not be cached by browsers or shared CDNs.
const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function GET(
  _request: Request,
  context: { params: { token: string } }
) {
  const token = context.params?.token?.trim() ?? "";

  if (!token) {
    return NextResponse.json(
      { code: ERROR_CODES.INVALID_INPUT, message: "Invalid share token." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const record = await resolveShareToken(token);
    if (!record) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Share link expired or not found." },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const report = await getReport(record.reportId);
    if (!report) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Report not found." },
        { status: 404, headers: NO_STORE_HEADERS }
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
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    const { status, code, message } = toApiErrorPayload(err);
    return NextResponse.json({ code, message }, { status, headers: NO_STORE_HEADERS });
  }
}
