/**
 * Report storage: filesystem (local dev) or Vercel Blob (production).
 */

import fs from "fs";
import path from "path";
import type { Report } from "@/types/report";
import { put, get } from "@vercel/blob";

const REPORTS_DIR = process.env.REPORTS_DIR ?? path.join(process.cwd(), "reports");
const REPORTS_BLOB_PREFIX = "reports/";

function useBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

export async function saveReport(reportId: string, report: Report): Promise<void> {
  const body = JSON.stringify(report, null, 2);

  if (useBlob()) {
    await put(`${REPORTS_BLOB_PREFIX}${reportId}.json`, body, {
      access: "public",
      contentType: "application/json",
    });
    return;
  }

  ensureReportsDir();
  const filePath = path.join(REPORTS_DIR, `${reportId}.json`);
  await fs.promises.writeFile(filePath, body, "utf-8");
}

export async function getReport(reportId: string): Promise<Report | null> {
  if (useBlob()) {
    const pathname = `${REPORTS_BLOB_PREFIX}${reportId}.json`;
    const result = await get(pathname, { access: "public" });
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

  const filePath = path.join(REPORTS_DIR, `${reportId}.json`);
  try {
    const data = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(data) as Report;
  } catch {
    return null;
  }
}
