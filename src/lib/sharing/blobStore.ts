/**
 * Private Vercel Blob persistence for stored-share records.
 */

import { del, get, list, put } from "@vercel/blob";
import { getStaticBlobToken } from "@/lib/storageConfig";
import {
  isValidShareToken,
  parseShareRecordJson,
  SHARES_BLOB_PREFIX,
  type ShareRecord,
} from "@/lib/sharing/records";

export async function saveBlobShareRecord(
  token: string,
  record: ShareRecord
): Promise<void> {
  const blobToken = getStaticBlobToken();
  await put(`${SHARES_BLOB_PREFIX}${token}.json`, JSON.stringify(record), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    ...(blobToken && { token: blobToken }),
  });
}

export async function loadBlobShareRecord(
  token: string
): Promise<ShareRecord | null> {
  const blobToken = getStaticBlobToken();
  try {
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

    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const buffer = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    return parseShareRecordJson(new TextDecoder().decode(buffer));
  } catch {
    return null;
  }
}

export async function deleteBlobShareRecord(token: string): Promise<void> {
  const blobToken = getStaticBlobToken();
  try {
    await del(`${SHARES_BLOB_PREFIX}${token}.json`, {
      ...(blobToken && { token: blobToken }),
    });
  } catch {
    /* ignore */
  }
}

export async function listBlobShareTokens(): Promise<string[]> {
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
        const shareToken = name.replace(/\.json$/, "");
        if (isValidShareToken(shareToken)) tokens.push(shareToken);
      }
    }
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);
  return tokens;
}
