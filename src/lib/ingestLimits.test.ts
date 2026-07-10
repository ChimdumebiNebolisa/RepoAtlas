import { describe, expect, it } from "vitest";
import {
  maxCompressedBytesForZipUpload,
  maxZipUploadMb,
  MAX_DEPLOYED_ZIP_BYTES,
  MAX_COMPRESSED_BYTES,
} from "./ingestLimits";

describe("ingestLimits", () => {
  it("uses 4MB cap on Vercel", () => {
    const prev = process.env.VERCEL;
    process.env.VERCEL = "1";
    expect(maxCompressedBytesForZipUpload()).toBe(MAX_DEPLOYED_ZIP_BYTES);
    expect(maxZipUploadMb()).toBe(4);
    process.env.VERCEL = prev;
  });

  it("uses 100MB cap locally", () => {
    const prev = process.env.VERCEL;
    delete process.env.VERCEL;
    expect(maxCompressedBytesForZipUpload()).toBe(MAX_COMPRESSED_BYTES);
    process.env.VERCEL = prev;
  });
});
