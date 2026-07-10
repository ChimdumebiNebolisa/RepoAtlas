import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { runIndexingPipeline } from "./pipeline";
import { MAX_DEPTH } from "@/lib/ingestLimits";

let root: string;

function write(rel: string, contents: string): void {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-test-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("runIndexingPipeline", () => {
  it("orders key docs deterministically with root docs first", async () => {
    write("packages/z/README.md", "# Z\n");
    write("packages/a/README.md", "# A\n");
    write("CONTRIBUTING.md", "# Contributing\n");
    write("README.md", "# Root\n");

    const result = await runIndexingPipeline(root);
    expect(result.key_docs).toEqual([
      "CONTRIBUTING.md",
      "README.md",
      "packages/a/README.md",
      "packages/z/README.md",
    ]);
  });

  it("warns instead of silently truncating deep folders", async () => {
    const deep = Array.from({ length: MAX_DEPTH + 2 }, (_, i) => `d${i}`).join("/");
    write(`${deep}/buried.md`, "# Buried\n");

    const result = await runIndexingPipeline(root);
    expect(result.warnings.some((w) => /truncated at depth/i.test(w))).toBe(true);
  });

  it("does not warn about truncation for shallow repositories", async () => {
    write("README.md", "# Root\n");
    write("src/index.ts", "export const x = 1;\n");

    const result = await runIndexingPipeline(root);
    expect(result.warnings.some((w) => /truncated at depth/i.test(w))).toBe(false);
  });
});
