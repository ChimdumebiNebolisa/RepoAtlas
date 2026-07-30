import { randomUUID } from "crypto";

import { retentionCleanupFailureLogPayload } from "@/lib/failureDiagnostics";
import { sweepExpiredReports } from "@/lib/storage";
import { sweepExpiredShareTokens } from "@/lib/sharing";

function cronMisconfigured(): boolean {
  const production = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  return production && !process.env.CRON_SECRET?.trim();
}

async function runCleanup(request: Request) {
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

/** Vercel Cron invokes the configured path with GET. */
export async function GET(request: Request) {
  return runCleanup(request);
}

/** Manual/operator entrypoint with the same authentication and behavior. */
export async function POST(request: Request) {
  return runCleanup(request);
}
