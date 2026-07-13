import { describe, it, expect } from "vitest";
import { isHttpUrl, repoSourceLabel, formatTimestamp } from "./format";

describe("isHttpUrl", () => {
  it("accepts http(s) URLs", () => {
    expect(isHttpUrl("https://github.com/owner/repo")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
  });

  it("rejects the zip sentinel and non-http values", () => {
    expect(isHttpUrl("zip")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
    expect(isHttpUrl(undefined)).toBe(false);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("/zip")).toBe(false);
  });
});

describe("repoSourceLabel", () => {
  it("returns the URL for GitHub analyses", () => {
    expect(repoSourceLabel("https://github.com/owner/repo")).toBe(
      "https://github.com/owner/repo"
    );
  });

  it("returns a friendly label for zip uploads instead of a broken link", () => {
    expect(repoSourceLabel("zip")).toBe("Uploaded ZIP");
    expect(repoSourceLabel("")).toBe("Uploaded ZIP");
  });
});

describe("formatTimestamp", () => {
  it("formats a valid ISO timestamp and preserves a machine-readable value", () => {
    const result = formatTimestamp("2026-07-10T17:12:37.205Z");
    expect(result.dateTime).toBe("2026-07-10T17:12:37.205Z");
    expect(result.display).toMatch(/2026/);
    expect(result.display).not.toBe("2026-07-10T17:12:37.205Z");
  });

  it("returns the original string for unparseable input", () => {
    const result = formatTimestamp("not-a-date");
    expect(result.display).toBe("not-a-date");
    expect(result.dateTime).toBeNull();
  });

  it("handles empty/nullish input without fabricating a date", () => {
    expect(formatTimestamp("").display).toBe("Unknown");
    expect(formatTimestamp(null).dateTime).toBeNull();
  });
});
