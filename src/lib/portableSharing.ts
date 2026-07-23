import type { Report } from "@/types/report";
import { validateReport } from "@/lib/reportSchema";

export const PORTABLE_SHARE_TOKEN = "portable";
export const PORTABLE_SHARE_MAX_URL_LENGTH = 24_000;

const PORTABLE_SHARE_VERSION = "v1";
const PORTABLE_SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PORTABLE_SHARE_AAD = new TextEncoder().encode("repoatlas-portable-share-v1");

type PortableShareErrorCode = "EXPIRED" | "INVALID" | "TOO_LARGE" | "UNSUPPORTED";

export class PortableShareError extends Error {
  constructor(public readonly code: PortableShareErrorCode, message: string) {
    super(message);
    this.name = "PortableShareError";
  }
}

interface PortableShareEnvelope {
  version: 1;
  createdAt: string;
  expiresAt: string;
  report: Report;
}

function requirePortableShareApis() {
  if (
    !globalThis.crypto?.subtle ||
    typeof CompressionStream === "undefined" ||
    typeof DecompressionStream === "undefined"
  ) {
    throw new PortableShareError(
      "UNSUPPORTED",
      "Private links are not supported in this browser. Export PDF to share this brief."
    );
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new PortableShareError("INVALID", "This private share link is invalid.");
  }
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    const binary = atob(`${normalized}${padding}`);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new PortableShareError("INVALID", "This private share link is invalid.");
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function compress(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toArrayBuffer(bytes)])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompress(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toArrayBuffer(bytes)])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function createPortableShareLink(
  report: Report,
  origin: string,
  now = new Date()
): Promise<{ url: string; expiresAt: string }> {
  requirePortableShareApis();

  const expiresAt = new Date(now.getTime() + PORTABLE_SHARE_TTL_MS).toISOString();
  const envelope: PortableShareEnvelope = {
    version: 1,
    createdAt: now.toISOString(),
    expiresAt,
    report,
  };

  const plaintext = await compress(new TextEncoder().encode(JSON.stringify(envelope)));
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    "AES-GCM",
    false,
    ["encrypt"]
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(PORTABLE_SHARE_AAD),
      },
      key,
      toArrayBuffer(plaintext)
    )
  );

  const fragment = [
    PORTABLE_SHARE_VERSION,
    bytesToBase64Url(iv),
    bytesToBase64Url(keyBytes),
    bytesToBase64Url(ciphertext),
  ].join(".");
  const url = `${origin.replace(/\/$/, "")}/share/${PORTABLE_SHARE_TOKEN}#${fragment}`;

  if (url.length > PORTABLE_SHARE_MAX_URL_LENGTH) {
    throw new PortableShareError(
      "TOO_LARGE",
      "This brief is too large for a private link. Export PDF to share it instead."
    );
  }

  return { url, expiresAt };
}

export async function openPortableShare(
  fragment: string,
  now = new Date()
): Promise<{ report: Report; createdAt: string; expiresAt: string }> {
  requirePortableShareApis();

  const parts = fragment.replace(/^#/, "").split(".");
  if (parts.length !== 4 || parts[0] !== PORTABLE_SHARE_VERSION) {
    throw new PortableShareError("INVALID", "This private share link is invalid.");
  }

  try {
    const iv = base64UrlToBytes(parts[1]);
    const keyBytes = base64UrlToBytes(parts[2]);
    const ciphertext = base64UrlToBytes(parts[3]);
    if (iv.length !== 12 || keyBytes.length !== 32) {
      throw new PortableShareError("INVALID", "This private share link is invalid.");
    }

    const key = await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(keyBytes),
      "AES-GCM",
      false,
      ["decrypt"]
    );
    const compressed = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: toArrayBuffer(iv),
          additionalData: toArrayBuffer(PORTABLE_SHARE_AAD),
        },
        key,
        toArrayBuffer(ciphertext)
      )
    );
    const envelope = JSON.parse(
      new TextDecoder().decode(await decompress(compressed))
    ) as Partial<PortableShareEnvelope>;

    if (envelope.version !== 1 || typeof envelope.createdAt !== "string" || typeof envelope.expiresAt !== "string") {
      throw new PortableShareError("INVALID", "This private share link is invalid.");
    }
    const createdAtMs = Date.parse(envelope.createdAt);
    const expiresAtMs = Date.parse(envelope.expiresAt);
    if (
      !Number.isFinite(createdAtMs) ||
      !Number.isFinite(expiresAtMs) ||
      new Date(createdAtMs).toISOString() !== envelope.createdAt ||
      new Date(expiresAtMs).toISOString() !== envelope.expiresAt ||
      expiresAtMs - createdAtMs !== PORTABLE_SHARE_TTL_MS
    ) {
      throw new PortableShareError("INVALID", "This private share link is invalid.");
    }
    if (expiresAtMs <= now.getTime()) {
      throw new PortableShareError("EXPIRED", "This private share link has expired.");
    }

    const validated = validateReport(envelope.report);
    if (!validated.ok) {
      throw new PortableShareError("INVALID", "This private share link is invalid.");
    }
    return {
      report: validated.report,
      createdAt: envelope.createdAt,
      expiresAt: envelope.expiresAt,
    };
  } catch (error) {
    if (error instanceof PortableShareError) throw error;
    throw new PortableShareError("INVALID", "This private share link is invalid.");
  }
}
