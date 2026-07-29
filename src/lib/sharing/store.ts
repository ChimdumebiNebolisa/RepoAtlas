/**
 * Select the configured stored-share persistence backend.
 */

import { hasBlobStorageCredentials } from "@/lib/storageConfig";
import {
  deleteBlobShareRecord,
  listBlobShareTokens,
  loadBlobShareRecord,
  saveBlobShareRecord,
} from "@/lib/sharing/blobStore";
import {
  deleteFilesystemShareRecord,
  listFilesystemShareTokens,
  loadFilesystemShareRecord,
  saveFilesystemShareRecord,
} from "@/lib/sharing/filesystemStore";
import { isValidShareToken, type ShareRecord } from "@/lib/sharing/records";

export async function saveShareRecord(
  token: string,
  record: ShareRecord
): Promise<void> {
  if (hasBlobStorageCredentials()) {
    return saveBlobShareRecord(token, record);
  }
  return saveFilesystemShareRecord(token, record);
}

export async function loadShareRecord(
  token: string
): Promise<ShareRecord | null> {
  if (!isValidShareToken(token)) return null;
  if (hasBlobStorageCredentials()) {
    return loadBlobShareRecord(token);
  }
  return loadFilesystemShareRecord(token);
}

export async function deleteShareRecord(token: string): Promise<void> {
  if (!isValidShareToken(token)) return;
  if (hasBlobStorageCredentials()) {
    return deleteBlobShareRecord(token);
  }
  return deleteFilesystemShareRecord(token);
}

export async function listShareTokens(): Promise<string[]> {
  if (hasBlobStorageCredentials()) {
    return listBlobShareTokens();
  }
  return listFilesystemShareTokens();
}
