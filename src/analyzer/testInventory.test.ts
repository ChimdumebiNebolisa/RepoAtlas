import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DangerZoneItem } from "@/types/report";
import { buildTestInventory, detectTestFrameworks } from "./testInventory";

let workspacePath: string;

function write(relativePath: string, content: string): void {
  const target = path.join(workspacePath, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function dangerZone(
  filePath: string,
  testProximity: number | undefined,
  score = 50
): DangerZoneItem {
  return {
    path: filePath,
    score,
    breakdown: "Controlled test inventory fixture.",
    metrics: { test_proximity: testProximity },
  };
}

beforeEach(() => {
  workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), "test-inventory-"));
});

afterEach(() => {
  fs.rmSync(workspacePath, { recursive: true, force: true });
});

describe("buildTestInventory", () => {
  it("returns an empty evidence-bounded inventory when no tests or danger zones exist", () => {
    expect(
      buildTestInventory({
        testFiles: new Set(),
        dangerZones: [],
        frameworks: [],
      })
    ).toEqual({
      test_file_count: 0,
      frameworks: [],
      tested_areas: [],
      untested_high_risk_files: [],
      suggested_test_targets: [],
      evidence_refs: [],
    });
  });

  it("normalizes TypeScript, Python, Java, nested, and Windows test paths", () => {
    const inventory = buildTestInventory({
      testFiles: new Set([
        "src/parser.test.ts",
        "src/parser.spec.ts",
        "tests/test_cli.py",
        "test/utils_test.py",
        "tests/__init__.py",
        "src/test/java/com/example/AppTest.java",
        "src\\__tests__\\service\\UserServiceTests.java",
      ]),
      dangerZones: [],
      frameworks: ["Vitest", "pytest", "JUnit"],
    });

    expect(inventory.tested_areas).toEqual([
      "src/parser.ts",
      "src/parser.ts",
      "cli.py",
      "utils.py",
      "src/java/com/example/App.java",
      "src/service/UserService.java",
    ]);
    expect(inventory.test_file_count).toBe(6);
    expect(inventory.frameworks).toEqual(["Vitest", "pytest", "JUnit"]);
  });

  it("keeps the danger-zone order, applies the strict proximity threshold, and caps output", () => {
    const dangerZones = [
      dangerZone("src/z.ts", 49, 90),
      dangerZone("src/a.ts", 49, 90),
      dangerZone("src/threshold.ts", 50, 80),
      dangerZone("src/missing.ts", undefined, 70),
      dangerZone("src/three.ts", 0, 60),
      dangerZone("src/four.ts", 10, 50),
      dangerZone("src/five.ts", 20, 40),
      dangerZone("src/capped.ts", 30, 30),
    ];

    const inventory = buildTestInventory({
      testFiles: new Set(Array.from({ length: 12 }, (_, index) => `tests/area-${index}.test.ts`)),
      dangerZones,
      frameworks: [],
    });

    expect(inventory.tested_areas).toHaveLength(10);
    expect(inventory.untested_high_risk_files).toEqual([
      "src/z.ts",
      "src/a.ts",
      "src/missing.ts",
      "src/three.ts",
      "src/four.ts",
    ]);
    expect(inventory.suggested_test_targets).toEqual([
      "src/z.ts",
      "src/a.ts",
      "src/missing.ts",
    ]);
  });
});

describe("detectTestFrameworks", () => {
  it("detects several JavaScript frameworks without mislabeling Jest globals as JUnit", () => {
    expect(
      detectTestFrameworks(workspacePath, {
        vitest: "latest",
        jest: "latest",
        mocha: "latest",
        "@jest/globals": "latest",
      })
    ).toEqual(["Vitest", "Jest", "Mocha"]);

    expect(detectTestFrameworks(workspacePath, { "@jest/globals": "latest" })).toEqual(["Jest"]);
  });

  it("detects pytest from Python dependency manifests", () => {
    write(
      "pyproject.toml",
      '[project.optional-dependencies]\ntest = ["pytest>=7.0"]\n'
    );
    write("requirements-dev.txt", "coverage==7.0\n");

    expect(detectTestFrameworks(workspacePath, {})).toEqual(["pytest"]);
  });

  it.each([
    [
      "pyproject comments and unrelated strings",
      {
        "pyproject.toml": [
          "[project]",
          'name = "fixture"',
          'description = "pytest appears in the contributor guide"',
          '# dependencies = ["pytest>=8"]',
        ].join("\n"),
      },
    ],
    [
      "requirements comments and examples",
      {
        "requirements.txt": "# pytest>=8\ncoverage==7 # try pytest locally",
        "requirements-dev.txt": "--find-links https://example.test/pytest",
      },
    ],
    [
      "an unrelated pytest ini section",
      {
        "pytest.ini": "[tooling]\nexample = pytest\n",
      },
    ],
    [
      "malformed Python declarations",
      {
        "pyproject.toml": '[project]\ndependencies = ["pytest>=8"\n',
        "requirements-dev.txt": '"pytest>=8"\n',
      },
    ],
  ])("ignores pytest found only in %s", (_label, files) => {
    for (const [relativePath, content] of Object.entries(files)) {
      write(relativePath, content);
    }

    expect(detectTestFrameworks(workspacePath, {})).toEqual([]);
  });

  it.each([
    ["requirements.txt", "pytest[testing]>=8 # supported extra"],
    ["requirements-dev.txt", "coverage==7\npytest~=8.0"],
    ["pytest.ini", "[pytest]\naddopts = -q"],
    [
      "pyproject.toml",
      [
        "[project]",
        "dependencies = [",
        '  "pytest>=8",',
        "]",
      ].join("\n"),
    ],
    [
      "pyproject.toml",
      [
        "[tool.poetry.group.test.dependencies]",
        'pytest = "^8.0"',
      ].join("\n"),
    ],
  ])("recognizes a valid pytest declaration in %s", (relativePath, content) => {
    write(relativePath, content);

    expect(detectTestFrameworks(workspacePath, {})).toEqual(["pytest"]);
  });

  it("detects JUnit from Java dependency manifests", () => {
    write(
      "pom.xml",
      [
        "<dependencies><dependency>",
        "<groupId>org.junit.jupiter</groupId>",
        "<artifactId>junit-jupiter</artifactId>",
        "</dependency></dependencies>",
      ].join("")
    );

    expect(detectTestFrameworks(workspacePath, {})).toEqual(["JUnit"]);
  });

  it.each([
    [
      "Maven comments and unrelated elements",
      {
        "pom.xml": [
          "<project>",
          "<!-- <dependency><artifactId>junit-jupiter</artifactId></dependency> -->",
          "<description>junit example</description>",
          "<description><![CDATA[",
          "<dependencies><dependency>",
          "<groupId>org.junit.jupiter</groupId><artifactId>junit-jupiter</artifactId>",
          "</dependency></dependencies>",
          "]]></description>",
          "</project>",
        ].join("\n"),
      },
    ],
    [
      "Gradle comments and unrelated strings",
      {
        "build.gradle": [
          "// testImplementation 'junit:junit:4.13.2'",
          "/* testImplementation('org.junit.jupiter:junit-jupiter:5.10.0') */",
          'def example = "junit"',
        ].join("\n"),
      },
    ],
    [
      "Kotlin examples and malformed declarations",
      {
        "build.gradle.kts": [
          'val example = "testImplementation(\\"org.junit.jupiter:junit-jupiter:5.10.0\\")"',
          'val guide = """',
          'testImplementation("org.junit.jupiter:junit-jupiter:5.10.0")',
          '"""',
          'testImplementation("org.junit.jupiter:junit-jupiter:5.10.0"',
          'testImplementation "org.junit.jupiter:junit-jupiter:5.10.0"',
        ].join("\n"),
      },
    ],
    [
      "malformed Maven dependencies",
      {
        "pom.xml": [
          "<dependencies>",
          "<dependency><groupId>org.junit.jupiter</groupId></dependency>",
          "<dependency><artifactId>junit-jupiter</artifactId></dependencies>",
        ].join("\n"),
      },
    ],
  ])("ignores JUnit found only in %s", (_label, files) => {
    for (const [relativePath, content] of Object.entries(files)) {
      write(relativePath, content);
    }

    expect(detectTestFrameworks(workspacePath, {})).toEqual([]);
  });

  it.each([
    [
      "pom.xml",
      [
        "<project><dependencies><dependency>",
        "<groupId>org.junit.jupiter</groupId>",
        "<artifactId>junit-jupiter</artifactId>",
        "<version>5.10.0</version>",
        "</dependency></dependencies></project>",
      ].join("\n"),
    ],
    ["build.gradle", "testImplementation 'junit:junit:4.13.2'"],
    [
      "build.gradle.kts",
      'testImplementation("org.junit.jupiter:junit-jupiter:5.10.0")',
    ],
  ])("recognizes a valid JUnit declaration in %s", (relativePath, content) => {
    write(relativePath, content);

    expect(detectTestFrameworks(workspacePath, {})).toEqual(["JUnit"]);
  });

  it("combines dependency and manifest evidence in a stable framework order", () => {
    write("pytest.ini", "[pytest]\n");
    write("build.gradle.kts", 'testImplementation("org.junit.jupiter:junit-jupiter:5.10.0")\n');

    expect(
      detectTestFrameworks(workspacePath, {
        vitest: "latest",
        mocha: "latest",
      })
    ).toEqual(["Vitest", "Mocha", "pytest", "JUnit"]);
  });

  it("degrades unreadable or missing manifests to dependency-only evidence", () => {
    fs.mkdirSync(path.join(workspacePath, "pyproject.toml"));
    fs.mkdirSync(path.join(workspacePath, "pom.xml"));

    expect(detectTestFrameworks(workspacePath, { pytest: "latest", junit: "latest" })).toEqual([
      "pytest",
      "JUnit",
    ]);
    expect(detectTestFrameworks(path.join(workspacePath, "missing"), {})).toEqual([]);
  });
});
