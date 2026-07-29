import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIB_DIR = path.join(process.cwd(), "src/lib");
const SHARING_DIR = path.join(LIB_DIR, "sharing");

function lineCount(filePath: string) {
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).length;
}

describe("stored sharing module structure", () => {
  it("keeps the facade and every focused production module at or below 300 lines", () => {
    const productionModules = [
      path.join(LIB_DIR, "sharing.ts"),
      ...fs
        .readdirSync(SHARING_DIR)
        .filter((fileName) => fileName.endsWith(".ts"))
        .map((fileName) => path.join(SHARING_DIR, fileName)),
    ];

    for (const modulePath of productionModules) {
      expect(
        lineCount(modulePath),
        `${path.relative(process.cwd(), modulePath)} exceeds 300 lines`
      ).toBeLessThanOrEqual(300);
    }
  });
});
