import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import { analyzeRepository, type AnalyzeInput } from "@/analyzer";
import {
  ERROR_CODES,
  toApiErrorPayload,
} from "@/lib/errors";
import { analyzeErrorLogPayload } from "@/lib/analyzeErrorLog";
import { MAX_ANALYSIS_TIME_MS, maxCompressedBytesForZipUpload, maxZipUploadMb } from "@/lib/ingestLimits";
import { canPersistReports } from "@/lib/storageConfig";
import {
  clientKeyFromHeaders,
  getMaxConcurrentAnalyses,
  getRateLimiter,
  tryAcquireAnalysisSlot,
} from "@/lib/rateLimit";
import { ANALYSIS_INTENTS, type AnalysisIntent } from "@/types/report";

// Discriminated input model:
//   - multipart upload  -> { kind: "zip" }   (server-created temp path)
//   - { sample: true }  -> { kind: "zip" }   (server-owned fixture path)
//   - { githubUrl,ref } -> { kind: "github" }
//
// Caller-controlled filesystem paths (the old JSON `zipRef`) are intentionally
// NOT accepted from the network — that path allowed reading arbitrary server
// files (Phase 1 finding A). Internal code/tests call analyzeRepository()
// directly for the zipRef path.

function logAnalyzeError(requestId: string, err: unknown): void {
  console.error(JSON.stringify(analyzeErrorLogPayload(requestId, err)));
}

function badRequest(code: string, message: string, status = 400, requestId?: string) {
  return NextResponse.json({ code, message, ...(requestId ? { requestId } : {}) }, { status });
}

function parseAnalysisIntent(value: unknown): AnalysisIntent | null {
  if (typeof value !== "string") return null;
  return ANALYSIS_INTENTS.find((intent) => intent === value) ?? null;
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  let tempZipPath: string | null = null;

  // Best-effort per-instance rate limit (see src/lib/rateLimit.ts for the
  // distributed-limiting caveat) + a conservative concurrency gate.
  const rateResult = await getRateLimiter().check(clientKeyFromHeaders(request.headers));
  if (!rateResult.allowed) {
    return NextResponse.json(
      {
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: "Too many analysis requests. Please wait and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateResult.retryAfterMs ?? 60_000) / 1000)),
        },
      }
    );
  }

  const slot = tryAcquireAnalysisSlot();
  if (!slot) {
    return NextResponse.json(
      {
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: `Server is busy (max ${getMaxConcurrentAnalyses()} concurrent analyses). Please retry shortly.`,
        requestId,
      },
      { status: 429, headers: { "Retry-After": "10" } }
    );
  }

  const deadlineController = new AbortController();
  const deadlineTimer = setTimeout(() => deadlineController.abort(), MAX_ANALYSIS_TIME_MS);
  const abortSignal = (() => {
    if (request.signal.aborted) {
      deadlineController.abort();
      return deadlineController.signal;
    }
    request.signal.addEventListener("abort", () => deadlineController.abort(), { once: true });
    return deadlineController.signal;
  })();

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let analyzeInput: AnalyzeInput | null = null;
    let analysisIntent: AnalysisIntent = "interview";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const requestedIntent = formData.get("analysisIntent");
      if (requestedIntent != null) {
        const parsedIntent = parseAnalysisIntent(requestedIntent);
        if (!parsedIntent) {
          return badRequest(ERROR_CODES.INVALID_INPUT, "Choose a supported analysis intent.");
        }
        analysisIntent = parsedIntent;
      }
      const file = formData.get("file") ?? formData.get("zip");
      if (!file || typeof file === "string") {
        return badRequest(ERROR_CODES.INVALID_INPUT, "Upload a single zip file.");
      }
      const blob = file as Blob;
      const zipName = "name" in file && typeof file.name === "string" ? file.name : undefined;
      if (blob.size > maxCompressedBytesForZipUpload()) {
        return badRequest(
          ERROR_CODES.REPO_TOO_LARGE,
          `Repository exceeds the ${maxZipUploadMb()}MB zip upload limit. For larger public repositories, use a GitHub URL instead.`,
          413,
          requestId
        );
      }
      const buffer = Buffer.from(await blob.arrayBuffer());
      tempZipPath = path.join(os.tmpdir(), `repoatlas-${randomUUID()}.zip`);
      await fs.promises.writeFile(tempZipPath, buffer);
      analyzeInput = { kind: "zip", zipRef: tempZipPath, zipName };
    } else if (contentType.includes("application/json")) {
      let body: Record<string, unknown>;
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        return badRequest(ERROR_CODES.INVALID_INPUT, "Request body is not valid JSON.");
      }
      if (body == null || typeof body !== "object") {
        return badRequest(ERROR_CODES.INVALID_INPUT, "Provide a JSON object.");
      }

      if (body.analysisIntent != null) {
        const parsedIntent = parseAnalysisIntent(body.analysisIntent);
        if (!parsedIntent) {
          return badRequest(ERROR_CODES.INVALID_INPUT, "Choose a supported analysis intent.");
        }
        analysisIntent = parsedIntent;
      }

      if (body.sample === true) {
        analyzeInput = {
          kind: "zip",
          zipRef: path.join(process.cwd(), "fixtures", "repo-ts"),
          zipName: "repo-ts",
        };
      } else if (typeof body.githubUrl === "string" && body.githubUrl.trim() !== "") {
        const ref =
          typeof body.ref === "string" && body.ref.trim() !== "" ? body.ref.trim() : undefined;
        analyzeInput = { kind: "github", githubUrl: body.githubUrl.trim(), ref };
      } else if ("zipRef" in body) {
        // Explicitly rejected: caller-controlled server paths are not analyzable
        // via the public API.
        return badRequest(
          ERROR_CODES.INVALID_INPUT,
          "zipRef is not accepted. Upload a zip file or provide a public GitHub URL."
        );
      } else {
        return badRequest(
          ERROR_CODES.INVALID_INPUT,
          "Provide a GitHub repository URL, upload a zip file, or request the sample."
        );
      }
    } else {
      return badRequest(
        ERROR_CODES.INVALID_INPUT,
        "Upload a zip file or send JSON with a githubUrl."
      );
    }

    const persistenceAvailable = canPersistReports();
    const report = await analyzeRepository(analyzeInput, {
      requestId,
      deadlineMs: MAX_ANALYSIS_TIME_MS,
      signal: abortSignal,
      persist: persistenceAvailable,
      allowInlineFallback: true,
      analysisIntent,
    });

    if (!report.reportId) {
      return NextResponse.json(
        { code: ERROR_CODES.ANALYSIS_FAILED, message: "No report produced", requestId },
        { status: 500 }
      );
    }

    return NextResponse.json(
      report.persisted
        ? { reportId: report.reportId, persisted: true }
        : { reportId: report.reportId, report: report.report, persisted: false }
    );
  } catch (err) {
    logAnalyzeError(requestId, err);
    const { status, code, message } = toApiErrorPayload(err);
    const headers =
      code === ERROR_CODES.RATE_LIMITED || code === ERROR_CODES.RATE_LIMIT_EXCEEDED
        ? { "Retry-After": "60" }
        : undefined;
    return NextResponse.json({ code, message, requestId }, { status, headers });
  } finally {
    clearTimeout(deadlineTimer);
    slot.release();
    if (tempZipPath) {
      try {
        await fs.promises.unlink(tempZipPath);
      } catch {
        /* ignore */
      }
    }
  }
}
