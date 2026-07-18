import { describe, expect, it } from "vitest";
import { buildSampleReport } from "@/lib/buildSampleReport";
import {
  createPortableShareLink,
  openPortableShare,
  PORTABLE_SHARE_MAX_URL_LENGTH,
  PortableShareError,
} from "@/lib/portableSharing";

describe("portable report sharing", () => {
  it("encrypts, compresses, and opens a realistic Candidate Brief", async () => {
    const report = buildSampleReport();
    const createdAt = new Date("2026-07-18T06:00:00.000Z");
    const share = await createPortableShareLink(report, "https://repoatlas.example", createdAt);

    expect(share.url).toMatch(/^https:\/\/repoatlas\.example\/share\/portable#v1\./);
    expect(share.url.length).toBeLessThan(PORTABLE_SHARE_MAX_URL_LENGTH);
    expect(share.url).not.toContain(report.repo_metadata.name);

    const opened = await openPortableShare(
      share.url.slice(share.url.indexOf("#")),
      new Date("2026-07-19T06:00:00.000Z")
    );
    expect(opened.report).toEqual(report);
    expect(opened.expiresAt).toBe(share.expiresAt);
  });

  it("rejects an expired portable link", async () => {
    const share = await createPortableShareLink(
      buildSampleReport(),
      "https://repoatlas.example",
      new Date("2026-07-01T00:00:00.000Z")
    );

    await expect(
      openPortableShare(share.url.slice(share.url.indexOf("#")), new Date("2026-07-09T00:00:00.000Z"))
    ).rejects.toMatchObject({ code: "EXPIRED" } satisfies Partial<PortableShareError>);
  });

  it("rejects a report that cannot fit in the bounded link", async () => {
    const report = buildSampleReport();
    report.warnings = Array.from({ length: 8_000 }, (_, index) =>
      `${index}-${crypto.randomUUID()}`
    );

    await expect(
      createPortableShareLink(report, "https://repoatlas.example")
    ).rejects.toMatchObject({ code: "TOO_LARGE" } satisfies Partial<PortableShareError>);
  });
});
