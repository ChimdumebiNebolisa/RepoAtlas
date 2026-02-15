import { NextRequest, NextResponse } from "next/server";
import { analyzeRepository } from "@/analyzer";
import { validateGithubUrl } from "@/lib/ingest";

const MAX_REPO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_ANALYSIS_TIME_MS = 120_000; // 120s

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { githubUrl, zipRef } = body;

    if (!githubUrl && !zipRef) {
      return NextResponse.json(
        { code: "INVALID_INPUT", message: "Provide githubUrl or zipRef" },
        { status: 400 }
      );
    }

    if (githubUrl) {
      const parsed = validateGithubUrl(githubUrl);
      if (!parsed) {
        return NextResponse.json(
          { code: "INVALID_URL", message: "Invalid GitHub URL" },
          { status: 400 }
        );
      }
    }

    const report = await Promise.race([
      analyzeRepository({ githubUrl, zipRef }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), MAX_ANALYSIS_TIME_MS)
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
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "TIMEOUT") {
      return NextResponse.json(
        { code: "TIMEOUT", message: "Analysis timed out" },
        { status: 504 }
      );
    }
    if (message.includes("CLONE_FAILED") || message.includes("clone")) {
      return NextResponse.json(
        { code: "CLONE_FAILED", message: "Git clone failed" },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { code: "ANALYSIS_FAILED", message },
      { status: 500 }
    );
  }
}
