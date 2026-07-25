import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CLIENT_MAX_ZIP_MB_VERCEL,
  clientMaxZipBytes,
  clientMaxZipMbLabel,
} from "./ingestLimitsClient";

const HOSTED_ZIP_BYTES = 4 * 1024 * 1024;

describe("ingestLimitsClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the hosted 4MB contract during server rendering", () => {
    expect(typeof window).toBe("undefined");
    expect(clientMaxZipBytes()).toBe(HOSTED_ZIP_BYTES);
    expect(clientMaxZipMbLabel()).toBe("4");
    expect(CLIENT_MAX_ZIP_MB_VERCEL).toBe(4);
  });

  it.each([
    "repo-atlas-phi.vercel.app",
    "repoatlas.example",
  ])("keeps the hosted 4MB contract on browser hostname %s", (hostname) => {
    vi.stubGlobal("window", { location: { hostname } });

    expect(clientMaxZipBytes()).toBe(HOSTED_ZIP_BYTES);
    expect(clientMaxZipMbLabel()).toBe("4");
  });
});
