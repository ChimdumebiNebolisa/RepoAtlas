/**
 * Stored-share creation, reuse, resolution, and retention lifecycle.
 */

import { randomBytes } from "crypto";
import { getReport } from "@/lib/storage";
import { SHARE_TTL_MS, type ShareRecord } from "@/lib/sharing/records";
import {
  deleteShareRecord,
  listShareTokens as listStoredShareTokens,
  loadShareRecord,
  saveShareRecord,
} from "@/lib/sharing/store";

async function findActiveShareForReport(
  reportId: string
): Promise<{ token: string; record: ShareRecord } | null> {
  const tokens = await listStoredShareTokens();
  const now = Date.now();
  for (const token of tokens) {
    const record = await loadShareRecord(token);
    if (!record || record.reportId !== reportId) continue;
    if (Date.parse(record.expiresAt) <= now) {
      await deleteShareRecord(token);
      continue;
    }
    return { token, record };
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
    return {
      token: existing.token,
      expiresAt: existing.record.expiresAt,
      sharePath: `/share/${existing.token}`,
    };
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

export async function resolveShareToken(
  token: string
): Promise<ShareRecord | null> {
  const record = await loadShareRecord(token);
  if (!record) return null;

  if (Date.parse(record.expiresAt) <= Date.now()) {
    await deleteShareRecord(token);
    return null;
  }

  return record;
}

export async function listShareTokens(): Promise<string[]> {
  return listStoredShareTokens();
}

/** Remove all share records pointing at a report (e.g. on report deletion). */
export async function deleteSharesForReport(
  reportId: string
): Promise<string[]> {
  const deleted: string[] = [];
  for (const token of await listStoredShareTokens()) {
    const record = await loadShareRecord(token);
    if (record?.reportId === reportId) {
      await deleteShareRecord(token);
      deleted.push(token);
    }
  }
  return deleted;
}

export async function sweepExpiredShareTokens(): Promise<{
  deleted: string[];
  scanned: number;
}> {
  const tokens = await listStoredShareTokens();
  const deleted: string[] = [];
  for (const token of tokens) {
    const record = await loadShareRecord(token);
    if (!record || Date.parse(record.expiresAt) <= Date.now()) {
      await deleteShareRecord(token);
      deleted.push(token);
    }
  }
  return { deleted, scanned: tokens.length };
}
