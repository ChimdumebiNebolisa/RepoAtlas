import { listReportIds, sweepExpiredReports } from "@/lib/storage";
import { sweepExpiredShareTokens } from "@/lib/sharing";
import { getReportMaxCount, getReportTtlDays } from "@/lib/reportTtl";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ code: "UNAUTHORIZED", message: "Invalid cron secret." }, { status: 401 });
    }
  }

  const [reports, shares] = await Promise.all([
    sweepExpiredReports(),
    sweepExpiredShareTokens(),
  ]);

  return Response.json({
    reports,
    shares,
    scannedAt: new Date().toISOString(),
  });
}

export async function GET() {
  const ids = await listReportIds();
  return Response.json({
    reportCount: ids.length,
    ttlDays: getReportTtlDays(),
    maxReports: getReportMaxCount(),
    note: "POST with Authorization: Bearer CRON_SECRET to run cleanup sweep.",
  });
}
