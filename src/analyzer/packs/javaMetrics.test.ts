import { describe, expect, it } from "vitest";
import { computeComplexitySignals } from "./javaMetrics";

describe("computeComplexitySignals", () => {
  it("keeps established executable branch and nesting values", () => {
    const content = [
      "class Example {",
      "  boolean choose(boolean ready, int count) {",
      "    if (ready) {",
      "      for (int index = 0; index < count; index++) {",
      "        while (index > 0) {",
      "          return true;",
      "        }",
      "      }",
      "    } else {",
      "      return false;",
      "    }",
      "  }",
      "}",
    ].join("\n");

    expect(computeComplexitySignals(content)).toEqual({
      loc: 13,
      branchCount: 3,
      maxNesting: 5,
      score: 19,
    });
  });

  it("does not count else or switch keywords as decision points", () => {
    const content = [
      "class Example {",
      "  int choose(int value) {",
      "    switch (value) {",
      "      case 1:",
      "        return 1;",
      "      default:",
      "        return 0;",
      "    }",
      "  }",
      "}",
    ].join("\n");
    // Each `case` label counts (matching the TS/JS pack's CaseClause rule);
    // `switch` and `default` do not.
    expect(computeComplexitySignals(content).branchCount).toBe(1);
  });

  it("does not count generic wildcards as decision points", () => {
    const content = [
      "class Example {",
      "  java.util.Map<String, ?> cache;",
      "  java.util.List<? extends Number> numbers;",
      "  int pick(boolean ready) {",
      "    return ready ? 1 : 0;",
      "  }",
      "}",
    ].join("\n");
    // Only the ternary counts; `<?>` and `<? extends>` are type wildcards.
    expect(computeComplexitySignals(content).branchCount).toBe(1);
  });

  it("excludes line and block comments from every complexity signal", () => {
    const executable = [
      "class Example {",
      "  int value() {",
      "    return 1;",
      "  }",
      "}",
    ].join("\n");
    const withComments = [
      "// if (ignored) {",
      "class Example {",
      "  /* while (ignored) {",
      "     for (;;) {",
      "  */",
      "  int value() {",
      "    return 1; // else { ? && ||",
      "  }",
      "}",
    ].join("\n");

    expect(computeComplexitySignals(withComments)).toEqual(
      computeComplexitySignals(executable)
    );
  });

  it("excludes string, character, and text-block contents from every signal", () => {
    const plain = [
      "class Example {",
      '  String text = "";',
      "  char marker = 'x';",
      "  String details =",
      '    "";',
      "}",
    ].join("\n");
    const withLiterals = [
      "class Example {",
      '  String text = "if \\"quoted\\" { for while } && || ?";',
      "  char marker = '{';",
      '  String details = """',
      "    if (ignored) {",
      "      while (ignored) {",
      "    }",
      '    """;',
      "}",
    ].join("\n");

    expect(computeComplexitySignals(withLiterals)).toEqual(
      computeComplexitySignals(plain)
    );
  });

  it.each([
    ["logical AND", "ready && valid"],
    ["logical OR", "ready || fallback"],
  ])("counts the %s operator as a branch", (_label, expression) => {
    const result = computeComplexitySignals(
      `class Example { boolean choose() { return ${expression}; } }`
    );
    expect(result.branchCount).toBe(1);
  });

  it("counts a ternary question mark as a branch", () => {
    const result = computeComplexitySignals(
      "class Example { int choose(boolean ready) { return ready ? 1 : 0; } }"
    );
    expect(result.branchCount).toBe(1);
  });

  it("keeps executable code around escaped literals and comments", () => {
    const result = computeComplexitySignals([
      "class Example {",
      '  String label = "not a branch: \\"if\\"";',
      "  boolean choose(boolean ready, boolean valid) {",
      "    return ready && valid ? true : false; // || ignored",
      "  }",
      "}",
    ].join("\n"));

    expect(result).toEqual({
      loc: 6,
      branchCount: 2,
      maxNesting: 2,
      score: 10,
    });
  });
});
