import { describe, expect, it } from "vitest";
import { shouldIndexFileContent, shouldSkipDir, shouldSkipPath } from "./ignoreRules";

describe("repository ignore rules", () => {
  it("skips known output and dependency directories without hiding similar names", () => {
    expect(shouldSkipDir("node_modules")).toBe(true);
    expect(shouldSkipDir("dist")).toBe(true);
    expect(shouldSkipDir("distribution")).toBe(false);

    expect(shouldSkipPath("packages/app/node_modules/library/index.js")).toBe(true);
    expect(shouldSkipPath("packages\\app\\dist\\bundle.js")).toBe(true);
    expect(shouldSkipPath("src/distribution/index.ts")).toBe(false);
  });

  it("skips binary assets regardless of extension case", () => {
    expect(shouldSkipPath("public/logo.png")).toBe(true);
    expect(shouldSkipPath("public/LOGO.PNG")).toBe(true);
    expect(shouldSkipPath("assets/archive.ZIP")).toBe(true);
    expect(shouldSkipPath("src/image.ts")).toBe(false);
  });

  it("skips generated minified files without hiding similarly named source files", () => {
    expect(shouldSkipPath("public/app.min.js")).toBe(true);
    expect(shouldSkipPath("public/styles.min.css")).toBe(true);
    expect(shouldSkipPath("public/APP.MIN.JS")).toBe(true);
    expect(shouldSkipPath("src/min.js.ts")).toBe(false);
    expect(shouldSkipPath("src/styles.min.scss")).toBe(false);
  });

  it("skips regular and TypeScript source maps without hiding source filenames", () => {
    expect(shouldSkipPath("public/app.js.map")).toBe(true);
    expect(shouldSkipPath("src/app.ts.map")).toBe(true);
    expect(shouldSkipPath("src/map.ts")).toBe(false);
    expect(shouldSkipPath("src/source-map.ts")).toBe(false);
  });

  it("excludes exact package-manager lockfiles from content indexing", () => {
    expect(shouldIndexFileContent("package-lock.json")).toBe(false);
    expect(shouldIndexFileContent("packages\\app\\yarn.lock")).toBe(false);
    expect(shouldIndexFileContent("packages/app/pnpm-lock.yaml")).toBe(false);
    expect(shouldIndexFileContent("services/api/poetry.lock")).toBe(false);
  });

  it("keeps similarly named source files available for content analysis", () => {
    expect(shouldIndexFileContent("src/package-lock-helper.ts")).toBe(true);
    expect(shouldIndexFileContent("src/yarn.lock.test.ts")).toBe(true);
    expect(shouldIndexFileContent("src/pnpm-lock-parser.ts")).toBe(true);
    expect(shouldIndexFileContent("src/poetry.lock.py")).toBe(true);
  });
});
