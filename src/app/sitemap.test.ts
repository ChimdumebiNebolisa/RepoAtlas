import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";

const baseUrl = "https://repo-atlas-phi.vercel.app";

const canonicalUrls = [
  baseUrl,
  `${baseUrl}/interview-preparation`,
  `${baseUrl}/repository-walkthrough-interview`,
  `${baseUrl}/how-to-walk-through-a-project-in-an-interview`,
  `${baseUrl}/take-home-coding-interview`,
  `${baseUrl}/codebase-interview-preparation`,
  `${baseUrl}/ai-codebase-summary`,
  `${baseUrl}/examples/fastapi-candidate-brief`,
  `${baseUrl}/examples/click-candidate-brief`,
  `${baseUrl}/examples/spring-petclinic-candidate-brief`,
  `${baseUrl}/code-review-interview`,
  `${baseUrl}/privacy`,
  `${baseUrl}/terms`,
  `${baseUrl}/contact`,
] as const;

describe("search discovery files", () => {
  it("lists every canonical public route exactly once", () => {
    const actualUrls = sitemap().map(({ url }) => url);

    expect(actualUrls).toEqual(canonicalUrls);
    expect(new Set(actualUrls)).toHaveLength(canonicalUrls.length);
    expect(actualUrls).toHaveLength(14);
  });

  it("publishes the IndexNow ownership key at the host root", async () => {
    const publicDirectory = path.join(process.cwd(), "public");
    const keyFiles = (await readdir(publicDirectory)).filter((file) =>
      /^[0-9a-f]{32}\.txt$/u.test(file)
    );

    expect(keyFiles).toHaveLength(1);

    const keyFile = keyFiles[0];
    const key = keyFile.slice(0, -4);
    expect((await readFile(path.join(publicDirectory, keyFile), "utf8")).trim()).toBe(key);
  });
});
