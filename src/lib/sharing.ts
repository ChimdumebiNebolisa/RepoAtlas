/**
 * Opt-in share tokens for read-only report access (7-day TTL).
 * Report JSON only — never exposes uploaded zip contents.
 */

import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { get, put } from "@vercel/blob";
import { getReport } from "@/lib/storage";

const REPORTS_DIR = process.env.REPORTS_DIR ?? path.join(process.cwd(), "reports");
const SHARES_DIR = path.join(REPORTS_DIR, "shares");
const SHARES_BLOB_PREFIX = "shares/";
const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface ShareRecord {
  reportId: string;
  createdAt: string;
  expiresAt: string;
}

function shouldUseBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function getBlobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

function ensureSharesDir(): void {
  if (!fs.existsSync(SHARES_DIR)) {
    fs.mkdirSync(SHARES_DIR, { recursive: true });
  }
}

function isValidShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{20,64}$/.test(token);
}

async function saveShareRecord(token: string, record: ShareRecord): Promise<void> {
  const body = JSON.stringify(record);

  if (shouldUseBlobStorage()) {
    const blobToken = getBlobToken();
    await put(`${SHARES_BLOB_PREFIX}${token}.json`, body, {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
      ...(blobToken && { token: blobToken }),
    });
    return;
  }

  ensureSharesDir();
  await fs.promises.writeFile(path.join(SHARES_DIR, `${token}.json`), body, "utf-8");
}

async function loadShareRecord(token: string): Promise<ShareRecord | null> {
  if (!isValidShareToken(token)) return null;

  if (shouldUseBlobStorage()) {
    const blobToken = getBlobToken();
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
    const data = await fs.promises.readFile(path.join(SHARES_DIR, `${token}.json`), "utf-8");
    return JSON.parse(data) as ShareRecord;
  } catch {
    return null;
  }
}

async function deleteShareRecord(token: string): Promise<void> {
  if (shouldUseBlobStorage()) {
    return;
  }
  try {
    await fs.promises.unlink(path.join(SHARES_DIR, `${token}.json`));
  } catch {
    /* ignore */
  }
}

export async function createShareLink(
  reportId: string
): Promise<{ token: string; expiresAt: string; sharePath: string }> {
  const report = await getReport(reportId);
  if (!report) {
    throw new Error("NOT_FOUND");
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
