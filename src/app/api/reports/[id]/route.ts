import { NextResponse } from "next/server";

import { ERROR_CODES, toApiErrorPayload } from "@/lib/errors";
import { getReport } from "@/lib/storage";

const UUID_LIKE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Report JSON is derived from untrusted, potentially private repositories and
// is served behind a hard-to-guess capability id. It must never be cached by
// browsers or shared CDNs.
const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function isValidReportId(id: string): boolean {
  const normalized = id.trim();
  return normalized.length > 0 && UUID_LIKE_PATTERN.test(normalized);
}

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  const id = context.params?.id?.trim() ?? "";

  if (!isValidReportId(id)) {
    return NextResponse.json(
      {
        code: ERROR_CODES.INVALID_INPUT,
        message: "Invalid report id.",
      },
      { status: 400, headers: NO_STORE_HEADERS }
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
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(report, { status: 200, headers: NO_STORE_HEADERS });
  } catch (err) {
    const { status, code, message } = toApiErrorPayload(err);
    return NextResponse.json({ code, message }, { status, headers: NO_STORE_HEADERS });
  }
}

// NOTE: The public `DELETE /api/reports/:id` mutation was intentionally
// removed. RepoAtlas has no user/ownership model, so an anonymous, guessable
// capability id must not be able to destroy stored reports. Retention is
// handled server-side by the TTL sweep in `@/lib/storage` (see the cron
// cleanup route), which calls `deleteReport` internally.
