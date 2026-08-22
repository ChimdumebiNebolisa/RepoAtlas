import { describe, expect, it } from "vitest";
import { computeAstComplexity, scriptKindForPath } from "./tsjsExtract";
import { computeComplexitySignals as pythonComplexity } from "./python/signals";
import { computeComplexitySignals as javaComplexity } from "./javaMetrics";

/**
 * F-002 regression: the three language packs must count the same decision
 * points for equivalent control flow. Danger Zones pools files from every pack
 * into one percentile ranking, so divergent keyword sets would systematically
 * bias one language's complexity percentiles.
 */
describe("cross-language complexity parity", () => {
  const pythonSource = [
    "def f(items):",
    "    for item in items:",
    "        if item:",
    "            process(item)",
    "        else:",
    "            skip(item)",
    "    try:",
    "        flush()",
    "    except ValueError:",
    "        log()",
    "    finally:",
    "        close()",
    "",
  ].join("\n");

  const typescriptSource = [
    "function f(items: Item[]): void {",
    "  for (const item of items) {",
    "    if (item) {",
    "      process(item);",
    "    } else {",
    "      skip(item);",
    "    }",
    "  }",
    "  try {",
    "    flush();",
    "  } catch {",
    "    log();",
    "  } finally {",
    "    close();",
    "  }",
    "}",
    "",
  ].join("\n");

  const javaSource = [
    "void f(Item[] items) {",
    "  for (Item item : items) {",
    "    if (item != null) {",
    "      process(item);",
    "    } else {",
    "      skip(item);",
    "    }",
    "  }",
    "  try {",
    "    flush();",
    "  } catch (IOException e) {",
    "    log();",
    "  } finally {",
    "    close();",
    "  }",
    "",
    "  Map<String, ?> cache;",
    "}",
    "",
  ].join("\n");

  it("counts identical decision points for equivalent control flow", () => {
    const ts = computeAstComplexity(
      typescriptSource,
      "sample.ts",
      scriptKindForPath("sample.ts")
    );
    const py = pythonComplexity(pythonSource);
    const java = javaComplexity(javaSource);

    expect(ts.branchCount).toBe(3);
    expect(py.branchCount).toBe(3);
    expect(java.branchCount).toBe(3);
  });

  it("keeps ternaries while ignoring generic wildcards in Java", () => {
    const result = javaComplexity(
      ["class A {", "  Map<String, ?> cache;", "  int f(boolean b) {", "    return b ? 1 : 0;", "  }", "}"].join("\n")
    );
    expect(result.branchCount).toBe(1);
  });
});
