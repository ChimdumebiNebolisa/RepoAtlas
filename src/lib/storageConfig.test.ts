import { afterEach, describe, expect, it } from "vitest";

import {
  canPersistReports,
  hasBlobStorageCredentials,
} from "@/lib/storageConfig";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("report storage capability", () => {
  it("recognizes a static Blob read-write token", () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.BLOB_STORE_ID;

    expect(hasBlobStorageCredentials()).toBe(true);
  });

  it("recognizes a complete Vercel OIDC credential pair", () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.VERCEL_OIDC_TOKEN = "test-oidc-token";
    process.env.BLOB_STORE_ID = "store_test";

    expect(hasBlobStorageCredentials()).toBe(true);
  });

  it("rejects incomplete OIDC configuration on Vercel", () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.VERCEL = "1";
    process.env.VERCEL_OIDC_TOKEN = "test-oidc-token";
    delete process.env.BLOB_STORE_ID;

    expect(hasBlobStorageCredentials()).toBe(false);
    expect(canPersistReports()).toBe(false);
  });

  it("keeps local filesystem persistence available without Blob credentials", () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.BLOB_STORE_ID;
    delete process.env.VERCEL;

    expect(canPersistReports()).toBe(true);
  });
});
