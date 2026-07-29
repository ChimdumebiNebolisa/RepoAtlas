/**
 * Atomic filesystem persistence for stored-share records.
 */

import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import {
  isValidShareToken,
  parseShareRecordJson,
  type ShareRecord,
} from "@/lib/sharing/records";

function getReportsDir(): string {
  return (
    process.env.REPORTS_DIR ??
    path.join(/*turbopackIgnore: true*/ process.cwd(), "reports")
  );
}

function getSharesDir(): string {
  return path.join(getReportsDir(), "shares");
}

function ensureSharesDir(): void {
  const sharesDir = getSharesDir();
  if (!fs.existsSync(/* turbopackIgnore: true */ sharesDir)) {
    fs.mkdirSync(/* turbopackIgnore: true */ sharesDir, { recursive: true });
  }
}

export async function saveFilesystemShareRecord(
  token: string,
  record: ShareRecord
): Promise<void> {
  ensureSharesDir();
  const target = path.join(getSharesDir(), `${token}.json`);
  const tmp = `${target}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    await fs.promises.writeFile(
      /* turbopackIgnore: true */ tmp,
      JSON.stringify(record),
      {
        encoding: "utf-8",
        mode: 0o600,
      }
    );
    await fs.promises.rename(
      /* turbopackIgnore: true */ tmp,
      /* turbopackIgnore: true */ target
    );
  } catch (error) {
    try {
      await fs.promises.unlink(/* turbopackIgnore: true */ tmp);
    } catch {
      /* ignore cleanup failures */
    }
    throw error;
  }
}

export async function loadFilesystemShareRecord(
  token: string
): Promise<ShareRecord | null> {
  try {
    const data = await fs.promises.readFile(
      /* turbopackIgnore: true */ path.join(
        getSharesDir(),
        `${token}.json`
      ),
      "utf-8"
    );
    return parseShareRecordJson(data);
  } catch {
    return null;
  }
}

export async function deleteFilesystemShareRecord(
  token: string
): Promise<void> {
  try {
    await fs.promises.unlink(
      /* turbopackIgnore: true */ path.join(getSharesDir(), `${token}.json`)
    );
  } catch {
    /* ignore */
  }
}

export async function listFilesystemShareTokens(): Promise<string[]> {
  ensureSharesDir();
  try {
    const files = await fs.promises.readdir(
      /* turbopackIgnore: true */ getSharesDir()
    );
    return files
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.replace(/\.json$/, ""))
      .filter(isValidShareToken);
  } catch {
    return [];
  }
}
