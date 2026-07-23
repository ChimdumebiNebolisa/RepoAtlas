import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSampleReport } from "@/lib/buildSampleReport";
import type { Report } from "@/types/report";
import {
  createPortableShareLink,
  openPortableShare,
  PORTABLE_SHARE_MAX_URL_LENGTH,
  PortableShareError,
} from "@/lib/portableSharing";

const PORTABLE_SHARE_AAD = new TextEncoder().encode(
  "repoatlas-portable-share-v1",
);

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toArrayBuffer(bytes)])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function encryptPayload(plaintext: Uint8Array): Promise<string> {
  const keyBytes = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
  const iv = Uint8Array.from({ length: 12 }, (_, index) => index + 41);
  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(PORTABLE_SHARE_AAD),
      },
      key,
      toArrayBuffer(plaintext),
    ),
  );
  return [iv, keyBytes, ciphertext].map(bytesToBase64Url).join(".");
}

async function encryptEnvelope(
  envelope: Record<string, unknown>,
): Promise<string> {
  return encryptPayload(
    await gzip(new TextEncoder().encode(JSON.stringify(envelope))),
  );
}

function validEnvelope(
  overrides: Partial<{
    version: number;
    createdAt: string;
    expiresAt: string;
    report: Report;
  }> = {},
) {
  return {
    version: 1,
    createdAt: "2026-07-01T00:00:00.000Z",
    expiresAt: "2026-07-08T00:00:00.000Z",
    report: buildSampleReport(),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("portable report sharing", () => {
  it("encrypts, compresses, and opens a realistic Candidate Brief", async () => {
    const report = buildSampleReport();
    const createdAt = new Date("2026-07-18T06:00:00.000Z");
    const share = await createPortableShareLink(
      report,
      "https://repoatlas.example/",
      createdAt,
    );

    expect(share.url).toMatch(
      /^https:\/\/repoatlas\.example\/share\/portable#v1\./,
    );
    expect(share.url.length).toBeLessThan(PORTABLE_SHARE_MAX_URL_LENGTH);
    expect(share.url).not.toContain(report.repo_metadata.name);

    const opened = await openPortableShare(
      share.url.slice(share.url.indexOf("#")),
      new Date("2026-07-19T06:00:00.000Z"),
    );
    expect(opened.report).toEqual(report);
    expect(opened.createdAt).toBe(createdAt.toISOString());
    expect(opened.expiresAt).toBe(share.expiresAt);
    expect(Date.parse(opened.expiresAt) - Date.parse(opened.createdAt)).toBe(
      7 * 24 * 60 * 60 * 1000,
    );
  });

  it("rejects an expired portable link", async () => {
    const share = await createPortableShareLink(
      buildSampleReport(),
      "https://repoatlas.example",
      new Date("2026-07-01T00:00:00.000Z"),
    );

    await expect(
      openPortableShare(
        share.url.slice(share.url.indexOf("#")),
        new Date("2026-07-09T00:00:00.000Z"),
      ),
    ).rejects.toMatchObject({
      code: "EXPIRED",
    } satisfies Partial<PortableShareError>);
  });

  it("rejects an envelope that claims longer than the seven-day boundary", async () => {
    const fragment = await encryptEnvelope(
      validEnvelope({
        expiresAt: "2027-07-01T00:00:00.000Z",
      }),
    );

    await expect(
      openPortableShare(`v1.${fragment}`, new Date("2026-07-02T00:00:00.000Z")),
    ).rejects.toMatchObject({
      code: "INVALID",
    } satisfies Partial<PortableShareError>);
  });

  it.each([
    ["missing segments", "v1.only-two"],
    ["unknown version", "v2.a.b.c"],
    ["invalid URL-safe data", "v1.!.a.a"],
    ["invalid base64 length", "v1.A.a.a"],
    [
      "invalid initialization vector",
      `v1.${bytesToBase64Url(new Uint8Array(11))}.${bytesToBase64Url(new Uint8Array(32))}.${bytesToBase64Url(new Uint8Array([1]))}`,
    ],
    [
      "invalid key",
      `v1.${bytesToBase64Url(new Uint8Array(12))}.${bytesToBase64Url(new Uint8Array(31))}.${bytesToBase64Url(new Uint8Array([1]))}`,
    ],
  ])("rejects %s", async (_label, fragment) => {
    await expect(openPortableShare(fragment)).rejects.toMatchObject({
      code: "INVALID",
    } satisfies Partial<PortableShareError>);
  });

  it.each([
    ["invalid created date", { createdAt: "not-a-date" }],
    ["invalid expiry date", { expiresAt: "not-a-date" }],
    ["non-canonical created date", { createdAt: "2026-07-01T00:00:00Z" }],
    ["non-canonical expiry date", { expiresAt: "2026-07-08T00:00:00Z" }],
  ])("rejects an envelope with %s", async (_label, overrides) => {
    const fragment = await encryptEnvelope(validEnvelope(overrides));

    await expect(
      openPortableShare(`v1.${fragment}`, new Date("2026-07-02T00:00:00.000Z")),
    ).rejects.toMatchObject({
      code: "INVALID",
    } satisfies Partial<PortableShareError>);
  });

  it.each([
    ["wrong version", { version: 2 }],
    ["missing created date", { createdAt: undefined }],
    ["missing expiry date", { expiresAt: undefined }],
    ["rejected report schema", { report: { repo_metadata: {} } }],
  ])("rejects an envelope with a %s", async (_label, overrides) => {
    const fragment = await encryptEnvelope({
      ...validEnvelope(),
      ...overrides,
    });

    await expect(
      openPortableShare(`v1.${fragment}`, new Date("2026-07-02T00:00:00.000Z")),
    ).rejects.toMatchObject({
      code: "INVALID",
    } satisfies Partial<PortableShareError>);
  });

  it.each([
    ["unsupported crypto", "crypto"],
    ["unsupported compression", "CompressionStream"],
    ["unsupported decompression", "DecompressionStream"],
  ])("reports %s before creating a link", async (_label, missingApi) => {
    if (missingApi === "crypto") vi.stubGlobal("crypto", {});
    else vi.stubGlobal(missingApi, undefined);

    await expect(
      createPortableShareLink(buildSampleReport(), "https://repoatlas.example"),
    ).rejects.toMatchObject({
      code: "UNSUPPORTED",
    } satisfies Partial<PortableShareError>);
  });

  it("normalizes decryption, decompression, parsing, and crypto failures", async () => {
    const valid = await encryptEnvelope(validEnvelope());
    const invalidGzip = await encryptPayload(
      new TextEncoder().encode("not gzip"),
    );
    const invalidJson = await encryptPayload(
      await gzip(new TextEncoder().encode("not json")),
    );
    const [iv, key, ciphertext] = valid.split(".");
    const tamperedCiphertext = `${ciphertext.startsWith("A") ? "B" : "A"}${ciphertext.slice(1)}`;

    await expect(
      openPortableShare(
        `v1.${iv}.${key}.${tamperedCiphertext}`,
        new Date("2026-07-02T00:00:00.000Z"),
      ),
    ).rejects.toMatchObject({ code: "INVALID" });
    await expect(openPortableShare(`v1.${invalidGzip}`)).rejects.toMatchObject({
      code: "INVALID",
    });
    await expect(openPortableShare(`v1.${invalidJson}`)).rejects.toMatchObject({
      code: "INVALID",
    });

    vi.spyOn(crypto.subtle, "importKey").mockRejectedValueOnce(
      new Error("provider detail"),
    );
    await expect(openPortableShare(`v1.${valid}`)).rejects.toMatchObject({
      code: "INVALID",
    });
  });

  it("rejects a report that cannot fit in the bounded link", async () => {
    const report = buildSampleReport();
    report.warnings = Array.from(
      { length: 8_000 },
      (_, index) => `${index}-${index.toString(36).padStart(12, "x")}`,
    );

    await expect(
      createPortableShareLink(report, "https://repoatlas.example"),
    ).rejects.toMatchObject({
      code: "TOO_LARGE",
    } satisfies Partial<PortableShareError>);
  });
});
