/**
 * Opt-in share tokens for read-only report access (7-day TTL).
 * Report JSON only — never exposes uploaded zip contents.
 */

import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { del, get, list, put } from "@vercel/blob";
import { getReport } from "@/lib/storage";
import { getStaticBlobToken, hasBlobStorageCredentials } from "@/lib/storageConfig";

const SHARES_BLOB_PREFIX = "shares/";
const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getReportsDir(): string {
  return (
    process.env.REPORTS_DIR ??
    path.join(/* turbopackIgnore: true */ process.cwd(), "reports")
  );
}

function getSharesDir(): string {
  return path.join(getReportsDir(), "shares");
}

export interface ShareRecord {
  reportId: string;
  createdAt: string;
  expiresAt: string;
}

function shouldUseBlobStorage(): boolean {
  return hasBlobStorageCredentials();
}

function ensureSharesDir(): void {
  const sharesDir = getSharesDir();
  if (!fs.existsSync(sharesDir)) {
    fs.mkdirSync(sharesDir, { recursive: true });
  }
}

function isValidShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{20,64}$/.test(token);
}

async function saveShareRecord(token: string, record: ShareRecord): Promise<void> {
  const body = JSON.stringify(record);

  if (shouldUseBlobStorage()) {
    const blobToken = getStaticBlobToken();
    await put(`${SHARES_BLOB_PREFIX}${token}.json`, body, {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
      ...(blobToken && { token: blobToken }),
    });
    return;
  }

  ensureSharesDir();
  const target = path.join(getSharesDir(), `${token}.json`);
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.promises.writeFile(tmp, body, { encoding: "utf-8", mode: 0o600 });
  await fs.promises.rename(tmp, target);
}

async function loadShareRecord(token: string): Promise<ShareRecord | null> {
  if (!isValidShareToken(token)) return null;

  if (shouldUseBlobStorage()) {
    const blobToken = getStaticBlobToken();
    const result = await get(`${SHARES_BLOB_PREFIX}${token}.json`, {
      access: "private",
      ...(blobToken && { token: blobToken }),
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
    try {
      return JSON.parse(new TextDecoder().decode(buffer)) as ShareRecord;
    } catch {
      return null;
    }
  }

  try {
    const data = await fs.promises.readFile(path.join(getSharesDir(), `${token}.json`), "utf-8");
    return JSON.parse(data) as ShareRecord;
  } catch {
    return null;
  }
}

async function deleteShareRecord(token: string): Promise<void> {
  if (!isValidShareToken(token)) return;

  if (shouldUseBlobStorage()) {
    const blobToken = getStaticBlobToken();
    try {
      await del(`${SHARES_BLOB_PREFIX}${token}.json`, {
        ...(blobToken && { token: blobToken }),
      });
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await fs.promises.unlink(path.join(getSharesDir(), `${token}.json`));
  } catch {
    /* ignore */
  }
}

async function findActiveShareForReport(reportId: string): Promise<ShareRecord | null> {
  const tokens = await listShareTokens();
  const now = new Date();
  for (const token of tokens) {
    const record = await loadShareRecord(token);
    if (!record || record.reportId !== reportId) continue;
    if (new Date(record.expiresAt) < now) {
      await deleteShareRecord(token);
      continue;
    }
    return record;
  }
  return null;
}

export async function createShareLink(
  reportId: string
): Promise<{ token: string; expiresAt: string; sharePath: string }> {
  const report = await getReport(reportId);
  if (!report) {
    throw new Error("NOT_FOUND");
  }

  const existing = await findActiveShareForReport(reportId);
  if (existing) {
    const tokens = await listShareTokens();
    for (const token of tokens) {
      const record = await loadShareRecord(token);
      if (record?.reportId === reportId && record.expiresAt === existing.expiresAt) {
        return {
          token,
          expiresAt: existing.expiresAt,
          sharePath: `/share/${token}`,
        };
      }
    }
  }

  const token = randomBytes(24).toString("base64url");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SHARE_TTL_MS);
  const record: ShareRecord = {
    reportId,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  await saveShareRecord(token, record);

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    sharePath: `/share/${token}`,
  };
}

export async function resolveShareToken(token: string): Promise<ShareRecord | null> {
  const record = await loadShareRecord(token);
  if (!record) return null;

  if (new Date(record.expiresAt) < new Date()) {
    await deleteShareRecord(token);
    return null;
  }

  return record;
}

export async function listShareTokens(): Promise<string[]> {
  if (shouldUseBlobStorage()) {
    const blobToken = getStaticBlobToken();
    const tokens: string[] = [];
    let cursor: string | undefined;
    do {
      const result = await list({
        prefix: SHARES_BLOB_PREFIX,
        ...(cursor && { cursor }),
        ...(blobToken && { token: blobToken }),
      });
      for (const blob of result.blobs) {
        const name = blob.pathname.slice(SHARES_BLOB_PREFIX.length);
        if (name.endsWith(".json")) {
          tokens.push(name.replace(/\.json$/, ""));
        }
      }
      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);
    return tokens;
  }
  ensureSharesDir();
  try {
    const files = await fs.promises.readdir(getSharesDir());
    return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}

/** Remove all share records pointing at a report (e.g. on report deletion). */
export async function deleteSharesForReport(reportId: string): Promise<string[]> {
  const deleted: string[] = [];
  for (const token of await listShareTokens()) {
    const record = await loadShareRecord(token);
    if (record?.reportId === reportId) {
      await deleteShareRecord(token);
      deleted.push(token);
    }
  }
  return deleted;
}

export async function sweepExpiredShareTokens(): Promise<{ deleted: string[]; scanned: number }> {
  const tokens = await listShareTokens();
  const deleted: string[] = [];
  for (const token of tokens) {
    const record = await loadShareRecord(token);
    if (!record) continue;
    if (new Date(record.expiresAt) < new Date()) {
      await deleteShareRecord(token);
      deleted.push(token);
    }
  }
  return { deleted, scanned: tokens.length };
}
