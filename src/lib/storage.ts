/**
 * Report storage: filesystem (local dev) or Vercel Blob (production).
 */

import fs from "fs";
import path from "path";
import type { Report } from "@/types/report";
import { put, get, list, del } from "@vercel/blob";
import { getReportMaxCount, getReportTtlMs } from "@/lib/reportTtl";

const REPORTS_BLOB_PREFIX = "reports/";
const UUID_FILE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Validates a report id shape so callers cannot address arbitrary blob paths. */
export function isValidReportId(reportId: string): boolean {
  return UUID_RE.test(reportId);
}

function getReportsDir(): string {
  return process.env.REPORTS_DIR ?? path.join(process.cwd(), "reports");
}

function isVercel(): boolean {
  return process.env.VERCEL === "1";
}

function shouldUseBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function getBlobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

function ensureReportsDir() {
  const reportsDir = getReportsDir();
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
}

export interface SweepReportsResult {
  deleted: string[];
  retained: number;
  scanned: number;
  skippedBlob: boolean;
}

export async function saveReport(reportId: string, report: Report): Promise<void> {
  const body = JSON.stringify(report, null, 2);

  if (shouldUseBlobStorage()) {
    const token = getBlobToken();
    await put(`${REPORTS_BLOB_PREFIX}${reportId}.json`, body, {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
      ...(token && { token }),
    });
    return;
  }

  if (isVercel()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is required on Vercel. Add it in Project Settings → Environment Variables (from your Blob store)."
    );
  }

  ensureReportsDir();
  const filePath = path.join(getReportsDir(), `${reportId}.json`);
  await fs.promises.writeFile(filePath, body, "utf-8");
}

export async function getReport(reportId: string): Promise<Report | null> {
  if (!isValidReportId(reportId)) return null;

  if (shouldUseBlobStorage()) {
    const pathname = `${REPORTS_BLOB_PREFIX}${reportId}.json`;
    const token = getBlobToken();
    const result = await get(pathname, {
      access: "private",
      ...(token && { token }),
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }
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
    const text = new TextDecoder().decode(buffer);
    try {
      return JSON.parse(text) as Report;
    } catch {
      return null;
    }
  }

  const filePath = path.join(getReportsDir(), `${reportId}.json`);
  try {
    const data = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(data) as Report;
  } catch {
    return null;
  }
}

export async function deleteReport(reportId: string): Promise<boolean> {
  if (!isValidReportId(reportId)) return false;

  if (shouldUseBlobStorage()) {
    const token = getBlobToken();
    try {
      await del(`${REPORTS_BLOB_PREFIX}${reportId}.json`, {
        ...(token && { token }),
      });
      return true;
    } catch {
      return false;
    }
  }

  const filePath = path.join(getReportsDir(), `${reportId}.json`);
  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

interface StoredReportEntry {
  id: string;
  /** Milliseconds since epoch for retention decisions (blob upload time). */
  storedAt: number;
}

async function listBlobReports(): Promise<StoredReportEntry[]> {
  const token = getBlobToken();
  const entries: StoredReportEntry[] = [];
  let cursor: string | undefined;
  do {
    const result = await list({
      prefix: REPORTS_BLOB_PREFIX,
      ...(cursor && { cursor }),
      ...(token && { token }),
    });
    for (const blob of result.blobs) {
      const file = blob.pathname.slice(REPORTS_BLOB_PREFIX.length);
      if (!UUID_FILE_RE.test(file)) continue;
      entries.push({
        id: file.replace(/\.json$/i, ""),
        storedAt: blob.uploadedAt instanceof Date ? blob.uploadedAt.getTime() : 0,
      });
    }
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);
  return entries;
}

export async function listReportIds(): Promise<string[]> {
  if (shouldUseBlobStorage()) {
    const entries = await listBlobReports();
    return entries.map((e) => e.id).sort();
  }

  ensureReportsDir();
  const files = await fs.promises.readdir(getReportsDir());
  return files
    .filter((f) => UUID_FILE_RE.test(f))
    .map((f) => f.replace(/\.json$/i, ""))
    .sort();
}

export async function sweepExpiredReports(): Promise<SweepReportsResult> {
  const ttlMs = getReportTtlMs();
  const maxCount = getReportMaxCount();
  const now = Date.now();

  const entries: Array<{ id: string; storedAt: number }> = [];

  if (shouldUseBlobStorage()) {
    // Blob metadata carries an upload timestamp, so retention can run without
    // downloading every report body.
    for (const entry of await listBlobReports()) {
      entries.push({ id: entry.id, storedAt: entry.storedAt });
    }
  } else {
    const ids = await listReportIds();
    for (const id of ids) {
      const report = await getReport(id);
      if (!report) continue;
      const analyzedAt = Date.parse(report.repo_metadata.analyzed_at);
      entries.push({ id, storedAt: Number.isFinite(analyzedAt) ? analyzedAt : 0 });
    }
  }

  entries.sort((a, b) => b.storedAt - a.storedAt);

  const deleted: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const { id, storedAt } = entries[i];
    const expired = storedAt > 0 && now - storedAt > ttlMs;
    const overMax = i >= maxCount;
    if (expired || overMax) {
      if (await deleteReport(id)) deleted.push(id);
    }
  }

  return {
    deleted,
    retained: entries.length - deleted.length,
    scanned: entries.length,
    skippedBlob: false,
  };
}
