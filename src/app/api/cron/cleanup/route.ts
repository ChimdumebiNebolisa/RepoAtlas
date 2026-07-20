import { randomUUID } from "crypto";

import { retentionCleanupFailureLogPayload } from "@/lib/failureDiagnostics";
import { sweepExpiredReports } from "@/lib/storage";
import { sweepExpiredShareTokens } from "@/lib/sharing";

function cronMisconfigured(): boolean {
  return process.env.VERCEL === "1" && !process.env.CRON_SECRET?.trim();
}

export async function POST(request: Request) {
  if (cronMisconfigured()) {
    return Response.json(
      { code: "MISCONFIGURED", message: "CRON_SECRET is required in production." },
      { status: 503 }
    );
  }

  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ code: "UNAUTHORIZED", message: "Invalid cron secret." }, { status: 401 });
    }
  }

  try {
    const [reports, shares] = await Promise.all([
      sweepExpiredReports(),
      sweepExpiredShareTokens(),
    ]);

    return Response.json({
      reports,
      shares,
      scannedAt: new Date().toISOString(),
    });
  } catch {
    const requestId = randomUUID();
    console.error(JSON.stringify(retentionCleanupFailureLogPayload(requestId)));
    return Response.json(
      {
        code: "CLEANUP_FAILED",
        message: "Cleanup failed. Check server logs.",
        requestId,
      },
      { status: 500 }
    );
  }
}

/** Authenticated health check only — no inventory scan. */
export async function GET(request: Request) {
  if (cronMisconfigured()) {
    return Response.json(
      { ok: false, message: "CRON_SECRET is required in production." },
      { status: 503 }
    );
  }

  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ code: "UNAUTHORIZED", message: "Invalid cron secret." }, { status: 401 });
    }
  }

  return Response.json({
    ok: true,
    message: "POST with Authorization: Bearer CRON_SECRET to run cleanup sweep.",
  });
}
