import { describe, it, expect } from "vitest";
import path from "path";
import { analyzeRepository } from "./index";

describe("analyzeRepository integration (acceptance)", () => {
  const fixturePath = path.resolve(__dirname, "../../fixtures/repo-ts");
  const javaFixturePath = path.resolve(__dirname, "../../fixtures/repo-java");
  const pythonFixturePath = path.resolve(__dirname, "../../fixtures/repo-python");

  it("produces report for local fixture (zipRef)", async () => {
    const result = await analyzeRepository({
      zipRef: fixturePath,
    });

    expect(result.reportId).toBeDefined();
    expect(result.report).toBeDefined();
    expect(result.report.repo_metadata.name).toContain("repo-ts");
    expect(result.report.folder_map).toBeDefined();
    expect(result.report.folder_map.type).toBe("dir");
    expect(result.report.start_here.length).toBeGreaterThanOrEqual(0);
    expect(result.report.architecture.nodes.length).toBeGreaterThan(0);
    expect(result.report.architecture.edges.length).toBeGreaterThan(0);
  }, 30000);

  it("Folder Map tab: renders non-empty tree", async () => {
    const result = await analyzeRepository({ zipRef: fixturePath });
    const tree = result.report.folder_map;
    expect(tree.type).toBe("dir");
    expect(tree.children).toBeDefined();
    expect(tree.children!.length).toBeGreaterThan(0);
  }, 30000);

  it("Architecture tab: has nodes and edges for TS fixture", async () => {
    const result = await analyzeRepository({ zipRef: fixturePath });
    const arch = result.report.architecture;
    expect(arch.nodes.length).toBeGreaterThan(0);
    expect(arch.edges.length).toBeGreaterThan(0);
    expect(arch.nodes.every((node) => node.type === "folder")).toBe(true);
    expect(result.report.warnings.some((w) => w.includes("Architecture"))).toBe(true);
  }, 30000);

  it("Start Here tab: contains README and/or entrypoint", async () => {
    const result = await analyzeRepository({ zipRef: fixturePath });
    const startHere = result.report.start_here;
    const paths = startHere.map((s) => s.path);
    const hasReadme = paths.some((p) => p.toLowerCase().includes("readme"));
    const hasEntrypoint = startHere.some((item) =>
      item.explanation.includes("detected entrypoint")
    );
    expect(hasReadme || hasEntrypoint).toBe(true);
  }, 30000);

  it("Danger Zones tab: has items for TS fixture with scores", async () => {
    const result = await analyzeRepository({ zipRef: fixturePath });
    const dz = result.report.danger_zones;
    expect(dz.length).toBeGreaterThan(0);
    expect(dz[0]).toHaveProperty("path");
    expect(dz[0]).toHaveProperty("score");
    expect(dz[0]).toHaveProperty("breakdown");
    expect(dz[0]).toHaveProperty("metrics");
    expect(dz[0].metrics).toHaveProperty("test_proximity");
    expect(dz.every((item) => item.score >= 0 && item.score <= 100)).toBe(true);
  }, 30000);

  it("Run & Contribute tab: has run_commands or contribute_signals", async () => {
    const result = await analyzeRepository({ zipRef: fixturePath });
    const hasRunCommands = result.report.run_commands.length > 0;
    const hasKeyDocs = result.report.contribute_signals.key_docs.length > 0;
    expect(hasRunCommands || hasKeyDocs).toBe(true);
  }, 30000);

  it("non-TS repo: keeps universal outputs and warns deep analysis unavailable", async () => {
    const result = await analyzeRepository({ zipRef: javaFixturePath });
    expect(result.report.repo_metadata.name).toContain("repo-java");
    expect(result.report.folder_map.type).toBe("dir");
    expect(result.report.start_here.some((item) => item.path.toLowerCase().includes("readme"))).toBe(
      true
    );
    expect(result.report.architecture.nodes.length).toBe(0);
    expect(result.report.danger_zones.length).toBe(0);
    expect(
      result.report.warnings.some(
        (w) =>
          w.includes("Deep analysis unavailable") ||
          w.includes("Deep TS/JS analysis unavailable")
      )
    ).toBe(true);
  }, 30000);

  it("Python fixture: produces architecture, start here, and danger zones", async () => {
    const result = await analyzeRepository({ zipRef: pythonFixturePath });
    expect(result.report.repo_metadata.name).toContain("repo-python");
    expect(result.report.folder_map.type).toBe("dir");
    expect(result.report.architecture.nodes.length).toBeGreaterThan(0);
    expect(result.report.architecture.edges.length).toBeGreaterThanOrEqual(0);
    const startPaths = result.report.start_here.map((s) => s.path);
    expect(
      startPaths.some((p) => p.includes("main.py") || p.includes("README") || p.includes("myapp"))
    ).toBe(true);
    expect(result.report.danger_zones.length).toBeGreaterThan(0);
    const firstDanger = result.report.danger_zones[0];
    expect(firstDanger.metrics?.complexity).toBeDefined();
    expect(firstDanger.metrics?.fan_in).toBeDefined();
    expect(
      result.report.warnings.some((w) => w.includes("Deep Python analysis unavailable"))
    ).toBe(false);
  }, 30000);
});
