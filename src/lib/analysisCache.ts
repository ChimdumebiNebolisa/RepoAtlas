/**
 * Same-SHA analysis result cache for public GitHub repositories.
 * Keyed by owner/repo@sha@intent@report_version so identical archives reuse a
 * prior report only when the analysis intent matches.
 */

import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import type { AnalysisIntent, Report } from "@/types/report";
import { REPORT_VERSION } from "@/types/report";
import { validateReport } from "@/lib/reportSchema";
import { getReportTtlMs } from "@/lib/reportTtl";
import {
  getStaticBlobToken,
  hasBlobStorageCredentials,
  isVercelRuntime,
} from "@/lib/storageConfig";
import { put, get, del } from "@vercel/blob";

const CACHE_PREFIX = "analysis-cache/";
const FUTURE_SKEW_MS = 60_000;

function cacheRoot(): string {
  return (
    process.env.ANALYSIS_CACHE_DIR ??
    path.join(/*turbopackIgnore: true*/ process.cwd(), "reports", "analysis-cache")
  );
}

export function analysisCacheKey(
  owner: string,
  repo: string,
  sha: string,
  intent: AnalysisIntent | undefined = "interview"
): string {
  const digest = createHash("sha256")
    .update(
      `${owner.toLowerCase()}/${repo.toLowerCase()}@${sha.toLowerCase()}@${intent ?? "interview"}@v${REPORT_VERSION}`
    )
    .digest("hex")
    .slice(0, 40);
  return digest;
}

function filesystemPath(key: string): string {
  return path.join(cacheRoot(), `${key}.json`);
}

interface CacheEnvelope {
  cached_at: string;
  owner: string;
  repo: string;
  sha: string;
  intent: AnalysisIntent;
  report: Report;
}

function parseEnvelope(raw: string): CacheEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.cached_at !== "string") return null;
    if (typeof parsed.owner !== "string" || typeof parsed.repo !== "string") return null;
    if (typeof parsed.sha !== "string" || typeof parsed.intent !== "string") return null;
    const validated = validateReport(parsed.report);
    if (!validated.ok) return null;
    return { ...parsed, report: validated.report };
  } catch {
    return null;
  }
}

function withinTtl(cachedAt: string): boolean {
  const ts = Date.parse(cachedAt);
  if (!Number.isFinite(ts)) return false;
  if (ts > Date.now() + FUTURE_SKEW_MS) return false;
  return Date.now() - ts <= getReportTtlMs();
}

export async function getCachedAnalysis(
  owner: string,
  repo: string,
  sha: string,
  intent: AnalysisIntent | undefined = "interview"
): Promise<Report | null> {
  const key = analysisCacheKey(owner, repo, sha, intent);
  const expectedIntent = intent ?? "interview";

  const accept = (envelope: CacheEnvelope | null): Report | null => {
    if (!envelope || !withinTtl(envelope.cached_at)) return null;
    if (
      envelope.owner.toLowerCase() !== owner.toLowerCase() ||
      envelope.repo.toLowerCase() !== repo.toLowerCase() ||
      envelope.sha.toLowerCase() !== sha.toLowerCase() ||
      envelope.intent !== expectedIntent
    ) {
      return null;
    }
    return envelope.report;
  };

  if (hasBlobStorageCredentials()) {
    const token = getStaticBlobToken();
    const result = await get(`${CACHE_PREFIX}${key}.json`, {
      access: "private",
      ...(token && { token }),
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const chunks: Uint8Array[] = [];
    const reader = result.stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const length = chunks.reduce((sum, c) => sum + c.length, 0);
    const buffer = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    const envelope = parseEnvelope(new TextDecoder().decode(buffer));
    const hit = accept(envelope);
    if (!hit && envelope) {
      await del(`${CACHE_PREFIX}${key}.json`, { ...(token && { token }) }).catch(() => undefined);
    }
    return hit;
  }

  if (isVercelRuntime()) return null;

  const filePath = filesystemPath(key);
  if (!fs.existsSync(/* turbopackIgnore: true */ filePath)) return null;
  const raw = await fs.promises.readFile(/* turbopackIgnore: true */ filePath, "utf-8");
  const envelope = parseEnvelope(raw);
  const hit = accept(envelope);
  if (!hit) {
    await fs.promises.unlink(/* turbopackIgnore: true */ filePath).catch(() => undefined);
  }
  return hit;
}

export async function putCachedAnalysis(
  owner: string,
  repo: string,
  sha: string,
  report: Report,
  intent: AnalysisIntent | undefined = "interview"
): Promise<void> {
  const key = analysisCacheKey(owner, repo, sha, intent);
  const envelope: CacheEnvelope = {
    cached_at: new Date().toISOString(),
    owner,
    repo,
    sha,
    intent: intent ?? "interview",
    report,
  };
  const body = JSON.stringify(envelope);

  if (hasBlobStorageCredentials()) {
    const token = getStaticBlobToken();
    await put(`${CACHE_PREFIX}${key}.json`, body, {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
      ...(token && { token }),
    });
    return;
  }

  if (isVercelRuntime()) return;

  const dir = cacheRoot();
  await fs.promises.mkdir(/* turbopackIgnore: true */ dir, { recursive: true });
  const filePath = filesystemPath(key);
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  await fs.promises.writeFile(/* turbopackIgnore: true */ tmpPath, body, {
    encoding: "utf-8",
    mode: 0o600,
  });
  await fs.promises.rename(
    /* turbopackIgnore: true */ tmpPath,
    /* turbopackIgnore: true */ filePath
  );
}
