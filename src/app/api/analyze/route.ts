import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import { analyzeRepository } from "@/analyzer";
import {
  AppError,
  ERROR_CODES,
  toApiErrorPayload,
  toAppError,
} from "@/lib/errors";

// Primary flow: multipart zip upload. Optional: JSON body with zipRef (tests/CLI).
const MAX_ANALYSIS_TIME_MS = 120_000; // 120s
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB

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
  let tempZipPath: string | null = null;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let zipRef: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") ?? formData.get("zip");
      if (!file || typeof file === "string") {
        return NextResponse.json(
          { code: ERROR_CODES.INVALID_INPUT, message: "Upload a single zip file." },
          { status: 400 }
        );
      }
      const blob = file as Blob;
      const size = blob.size;
      if (size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          {
            code: ERROR_CODES.REPO_TOO_LARGE,
            message: "Repository exceeds the 100MB limit. Try a smaller zip.",
          },
          { status: 413 }
        );
      }
      const buffer = Buffer.from(await blob.arrayBuffer());
      tempZipPath = path.join(os.tmpdir(), `repoatlas-${randomUUID()}.zip`);
      await fs.promises.writeFile(tempZipPath, buffer);
      zipRef = tempZipPath;
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      zipRef = body.zipRef;
      if (!zipRef) {
        return NextResponse.json(
          { code: ERROR_CODES.INVALID_INPUT, message: "Provide zipRef or upload a zip file." },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { code: ERROR_CODES.INVALID_INPUT, message: "Upload a zip file or send JSON with zipRef." },
        { status: 400 }
      );
    }

    const report = await Promise.race([
      analyzeRepository({ zipRef }),
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
  } finally {
    if (tempZipPath) {
      try {
        await fs.promises.unlink(tempZipPath);
      } catch {
        /* ignore */
      }
    }
  }
}
