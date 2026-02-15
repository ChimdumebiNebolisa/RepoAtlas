import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { analyzeRepository } from "@/analyzer";
import { validateGithubUrl } from "@/lib/ingest";
import {
  AppError,
  ERROR_CODES,
  toApiErrorPayload,
  toAppError,
} from "@/lib/errors";

const MAX_ANALYSIS_TIME_MS = 120_000; // 120s

function logAnalyzeError(requestId: string, err: unknown): void {
  const appErr = toAppError(err);
  const payload: Record<string, unknown> = {
    requestId,
    code: appErr.code,
    status: appErr.status,
    message: appErr.message,
  };
  if (appErr.meta) payload.meta = appErr.meta;
  if (appErr.cause != null) {
    payload.cause =
      appErr.cause instanceof Error
        ? { name: appErr.cause.name, message: appErr.cause.message }
        : String(appErr.cause);
  }
  console.error(JSON.stringify({ level: "error", ...payload }));
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const body = await request.json();
    const { githubUrl, zipRef } = body;

    if (!githubUrl && !zipRef) {
      return NextResponse.json(
        { code: ERROR_CODES.INVALID_INPUT, message: "Provide githubUrl or zipRef" },
        { status: 400 }
      );
    }

    if (githubUrl) {
      const parsed = validateGithubUrl(githubUrl);
      if (!parsed) {
        return NextResponse.json(
          { code: ERROR_CODES.INVALID_URL, message: "Invalid GitHub URL" },
          { status: 400 }
        );
      }
    }

    const report = await Promise.race([
      analyzeRepository({ githubUrl, zipRef }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new AppError({
                code: ERROR_CODES.TIMEOUT,
                status: 504,
                message: "Analysis timed out.",
              })
            ),
          MAX_ANALYSIS_TIME_MS
        )
      ),
    ]);

    if (!report.reportId) {
      return NextResponse.json(
        { code: "ANALYSIS_FAILED", message: "No report produced" },
        { status: 500 }
      );
    }

    return NextResponse.json({ reportId: report.reportId });
  } catch (err) {
    logAnalyzeError(requestId, err);
    const { status, code, message } = toApiErrorPayload(err);
    return NextResponse.json({ code, message }, { status });
  }
}
