import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("production build guard", () => {
  it("launches the Next.js CLI through Node on every platform", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "scripts", "check-build-output.mjs"),
      "utf8"
    );

    expect(source).toContain('require.resolve("next/dist/bin/next")');
    expect(source).toContain(
      'spawn(process.execPath, [nextCli, "build", "--webpack"]'
    );
    expect(source).not.toContain("next.cmd");
    expect(source).toContain('file.replaceAll("\\\\", "/")');
    expect(source).toContain("sanitizeRuntimeDataTraces");
    expect(source).toContain("Removed ${removedRuntimeFiles}");
  });
});
