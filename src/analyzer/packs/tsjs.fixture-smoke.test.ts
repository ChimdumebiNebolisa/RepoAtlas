import path from "path";
import { describe, expect, it } from "vitest";
import { runIndexingPipeline } from "../pipeline";
import { runTsJsPack } from "./tsjs";

describe("fixture semantic graph smoke", () => {
  it.each(["repo-ts", "repo-monorepo", "repo-node-api"])(
    "analyzes %s with semantic graph stats",
    async (name) => {
      const root = path.join(process.cwd(), "fixtures", name);
      const pipeline = await runIndexingPipeline(root);
      const result = runTsJsPack(root, pipeline);
      expect(result.semanticGraph).toBeTruthy();
      expect(result.semanticGraph!.stats.edge_count).toBeGreaterThanOrEqual(0);
      // Keep console output for before/after documentation in PRs.
      console.log(
        JSON.stringify(
          {
            fixture: name,
            importFiles: result.imports.size,
            internalFanEdges: [...result.imports.values()].reduce(
              (n, set) => n + set.size,
              0
            ),
            archNodes: result.architecture.nodes.length,
            archEdges: result.architecture.edges.length,
            stats: result.semanticGraph?.stats,
            entrypoints: [...result.entrypoints]
              .map((p) => p.replace(/\\/g, "/"))
              .sort(),
          },
          null,
          2
        )
      );
    }
  );
});
