import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { buildSampleReport } from "@/lib/buildSampleReport";
import type {
  ArchitectureInsights,
  CommitInsights,
  DocumentInventory,
  FolderMapNode,
  ProjectProfile,
  Report,
  TestInventory,
} from "@/types/report";
import { DangerZonesTable } from "./DangerZonesTable";
import { DeepAnalysisSection } from "./DeepAnalysisSection";
import { DocumentsPanel } from "./DocumentsPanel";
import { FolderMapTree } from "./FolderMapTree";
import { ReportDocument } from "./ReportDocument";
import { ReportOverview } from "./ReportOverview";
import { RunContributeSection } from "./RunContributeSection";
import { StartHereTable } from "./StartHereTable";

vi.mock("./ElkArchitectureGraph", () => ({
  ElkArchitectureGraph: () => <p>Architecture graph contract</p>,
}));
vi.mock("./CandidateBriefPanel", () => ({
  CandidateBriefPanel: () => <p>Candidate brief contract</p>,
}));

afterEach(() => cleanup());

const projectProfile: ProjectProfile = {
  type: "nextjs",
  label: "Next.js application",
  confidence: "high",
  signals: ["app/", "next dependency"],
  evidence_refs: ["profile"],
};

const testInventory: TestInventory = {
  test_file_count: 12,
  frameworks: ["Vitest", "Playwright"],
  tested_areas: ["analyzer"],
  untested_high_risk_files: [
    "src/one.ts",
    "src/two.ts",
    "src/three.ts",
    "src/four.ts",
    "src/five.ts",
    "src/not-shown.ts",
  ],
  suggested_test_targets: [
    "src/a.ts",
    "src/b.ts",
    "src/c.ts",
    "src/d.ts",
    "src/not-shown.ts",
  ],
  evidence_refs: ["tests"],
};

const architectureInsights: ArchitectureInsights = {
  layers: ["app", "lib"],
  hubs: ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/e.ts", "src/not-shown.ts"],
  violations: [
    { from: "app", to: "data", reason: "skips the service boundary" },
    { from: "web", to: "db", reason: "imports persistence directly" },
    { from: "ui", to: "fs", reason: "uses a server boundary" },
    { from: "view", to: "store", reason: "writes state directly" },
    { from: "not", to: "shown", reason: "is beyond the display cap" },
  ],
  circular_deps: [["src/a.ts", "src/b.ts"]],
};

const commitInsights: CommitInsights = {
  mode: "github_api",
  recent_work_areas: ["src/components", "src/analyzer"],
  high_churn_files: ["src/components/ReportDocument.tsx"],
  co_changed_pairs: [],
  evidence_refs: ["commits"],
};

const completeDocuments: DocumentInventory = {
  canonical_readme: "README.md",
  duplicate_groups: [
    {
      canonical: "README.md",
      duplicates: ["docs/README.md"],
      reason: "identical",
    },
    {
      canonical: "CONTRIBUTING.md",
      duplicates: ["docs/contributing.md"],
      reason: "normalized-identical",
    },
  ],
  similar_groups: [{ paths: ["README.md", "docs/guide.md"], similarity: 0.876 }],
  documents: [
    {
      path: "README.md",
      category: "readme",
      scope: "root",
      bytes: 900,
      content_hash: "a",
      normalized_hash: "a",
      canonical: true,
    },
    {
      path: "docs/README.md",
      category: "docs",
      scope: "docs",
      bytes: 2_048,
      content_hash: "a",
      normalized_hash: "a",
      canonical: false,
      duplicate_of: "README.md",
    },
    {
      path: "docs/guide.md",
      category: "docs",
      scope: "nested",
      bytes: 2 * 1_024 * 1_024,
      content_hash: "b",
      normalized_hash: "b",
      canonical: true,
      duplicate_of: "README.md",
    },
  ],
};

describe("DeepAnalysisSection", () => {
  it("explains when deep signals are unavailable", () => {
    render(<DeepAnalysisSection commitInsights={{ ...commitInsights, mode: "unavailable" }} />);

    expect(screen.getByText(/signals appear here when the repository has enough structure/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Commit insights" })).not.toBeInTheDocument();
  });

  it("renders complete project, test, architecture, and commit evidence with display caps", () => {
    render(
      <DeepAnalysisSection
        projectProfile={projectProfile}
        testInventory={testInventory}
        architectureInsights={architectureInsights}
        commitInsights={commitInsights}
      />
    );

    expect(screen.getByText("Next.js application")).toBeInTheDocument();
    expect(screen.getByText(/Type: nextjs · high confidence/i)).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        Boolean(element?.tagName === "P" && element.textContent === "12 test file(s) · Vitest, Playwright")
      )
    ).toBeInTheDocument();
    expect(screen.getByText("src/five.ts")).toBeInTheDocument();
    expect(screen.queryByText("src/not-shown.ts")).not.toBeInTheDocument();
    expect(screen.getByText(/Layers: app → lib/i)).toBeInTheDocument();
    expect(screen.getByText(/1 circular dependency chain\(s\) detected/i)).toBeInTheDocument();
    expect(screen.getByText(/Source: github api/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent areas: src\/components, src\/analyzer/i)).toBeInTheDocument();
  });

  it("keeps sparse available signals readable", () => {
    render(
      <DeepAnalysisSection
        projectProfile={{ ...projectProfile, signals: [] }}
        testInventory={{
          ...testInventory,
          frameworks: [],
          untested_high_risk_files: [],
          suggested_test_targets: [],
        }}
        architectureInsights={{ layers: [], hubs: [], violations: [], circular_deps: [] }}
        commitInsights={{ ...commitInsights, recent_work_areas: [], high_churn_files: [] }}
      />
    );

    expect(
      screen.getByText((_, element) =>
        Boolean(element?.tagName === "P" && element.textContent === "12 test file(s)")
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Architecture boundaries" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Commit insights" })).toBeInTheDocument();
  });
});

describe("DocumentsPanel", () => {
  it("renders the empty state without a table", () => {
    render(<DocumentsPanel inventory={{ documents: [], duplicate_groups: [] }} />);

    expect(screen.getByText("No documentation files detected in this repository.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders canonical, duplicate, similar, and size evidence", () => {
    render(<DocumentsPanel inventory={completeDocuments} />);

    expect(screen.getByText("README.md", { selector: ".text-emerald-800" })).toBeInTheDocument();
    expect(screen.getByText("Identical content")).toBeInTheDocument();
    expect(screen.getByText("Normalized-identical content")).toBeInTheDocument();
    expect(screen.getByText("88% similar")).toBeInTheDocument();
    expect(screen.getByText("900 B")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    expect(screen.getByText("2.0 MB")).toBeInTheDocument();
    const guideRow = screen.getAllByText("docs/guide.md").find((element) => element.closest("tr"));
    expect(guideRow).toBeDefined();
    expect(guideRow?.closest("tr")).toHaveTextContent("canonical; duplicate of README.md");
  });

  it("omits optional document groups when they are absent", () => {
    render(
      <DocumentsPanel
        inventory={{
          documents: [completeDocuments.documents[0]],
          duplicate_groups: [],
          similar_groups: [],
        }}
      />
    );

    expect(screen.queryByRole("heading", { name: "Duplicate documents" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Similar documents" })).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

describe("RunContributeSection", () => {
  it("renders empty run and contribution signals", () => {
    render(
      <RunContributeSection
        runCommands={[]}
        contributeSignals={{ key_docs: [], ci_configs: [] }}
      />
    );

    expect(screen.getByText("No run commands detected.")).toBeInTheDocument();
    expect(screen.getAllByText("None found")).toHaveLength(2);
  });

  it("renders command sources, optional descriptions, docs, and CI evidence", () => {
    render(
      <RunContributeSection
        runCommands={[
          { command: "npm test", source: "package.json", description: "Run tests" },
          { command: "make check", source: "Makefile" },
        ]}
        contributeSignals={{ key_docs: ["CONTRIBUTING.md"], ci_configs: [".github/workflows/ci.yml"] }}
      />
    );

    expect(screen.getByText("npm test")).toBeInTheDocument();
    expect(screen.getByText(/\(from package.json\) — Run tests/i)).toBeInTheDocument();
    expect(screen.getByText(/\(from Makefile\)$/i)).toBeInTheDocument();
    expect(screen.getByText("CONTRIBUTING.md")).toBeInTheDocument();
    expect(screen.getByText(".github/workflows/ci.yml")).toBeInTheDocument();
  });
});

describe("FolderMapTree", () => {
  const folderMap: FolderMapNode = {
    path: ".",
    type: "dir",
    children: [
      { path: "README.md", type: "file" },
      { path: "empty", type: "dir", children: [] },
      {
        path: "src",
        type: "dir",
        children: [
          {
            path: "src/deep",
            type: "dir",
            children: [{ path: "src/deep/file.ts", type: "file" }],
          },
          { path: "src/limited", type: "dir", children: [], truncated: true },
        ],
      },
    ],
  };

  it("expands nested folders and collapses them from an accessible button", () => {
    render(<FolderMapTree node={folderMap} defaultExpandDepth={1} />);

    const src = screen.getByText("src").closest("button");
    expect(src).not.toBeNull();
    expect(src).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("deep")).not.toBeInTheDocument();

    fireEvent.click(src!);
    expect(src).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("deep")).toBeInTheDocument();

    fireEvent.click(src!);
    expect(src).toHaveAttribute("aria-expanded", "false");
  });

  it("identifies a depth-limited directory instead of presenting it as empty", () => {
    render(<FolderMapTree node={folderMap} defaultExpandDepth={1} />);

    fireEvent.click(screen.getByText("src").closest("button")!);
    expect(screen.getByText("limited")).toBeInTheDocument();
    expect(screen.getByText("RepoAtlas stopped mapping at this depth.")).toHaveAttribute(
      "data-folder-map-state",
      "truncated"
    );
    expect(within(screen.getByText("limited").parentElement!).queryByText("0")).not.toBeInTheDocument();
  });

  it("uses default expansion depth and keeps deep file paths compact", () => {
    render(<FolderMapTree node={folderMap} />);

    expect(screen.getByText("deep")).toBeInTheDocument();
    fireEvent.click(screen.getByText("deep").closest("button")!);
    expect(screen.getByText("file.ts")).toBeInTheDocument();
    expect(screen.queryByText("src/deep/file.ts")).not.toBeInTheDocument();
  });
});

describe("StartHereTable", () => {
  it("renders an empty state", () => {
    render(<StartHereTable items={[]} />);
    expect(screen.getByText("No Start Here items for this repository.")).toBeInTheDocument();
  });

  it("sorts reading priorities by score and path", () => {
    render(
      <StartHereTable
        items={[
          { path: "z.ts", score: 10.4, explanation: "Later" },
          { path: "a.ts", score: 99.6, explanation: "First" },
        ]}
      />
    );

    const rows = () => screen.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0].textContent);
    expect(rows()).toEqual(["a.ts", "z.ts"]);
    expect(screen.getByTitle(/Priority: 100/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Priority \(0–100\)/i }));
    expect(rows()).toEqual(["z.ts", "a.ts"]);
    fireEvent.click(screen.getByRole("button", { name: /^Path/i }));
    expect(rows()).toEqual(["a.ts", "z.ts"]);
    fireEvent.click(screen.getByRole("button", { name: /^Path/i }));
    expect(rows()).toEqual(["z.ts", "a.ts"]);
  });
});

describe("DangerZonesTable", () => {
  it("renders an empty state", () => {
    render(<DangerZonesTable items={[]} />);
    expect(screen.getByText("No Danger Zones for this repository.")).toBeInTheDocument();
  });

  it("sorts risk signals by score and path", () => {
    render(
      <DangerZonesTable
        items={[
          { path: "z.ts", score: -5, breakdown: "Low", metrics: {} },
          { path: "a.ts", score: 101, breakdown: "High", metrics: {} },
        ]}
      />
    );

    const rows = () => screen.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0].textContent);
    expect(rows()).toEqual(["a.ts", "z.ts"]);
    expect(screen.getByTitle(/Risk: 101/i)).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Risk \(0–100\)/i }));
    expect(rows()).toEqual(["z.ts", "a.ts"]);
    fireEvent.click(screen.getByRole("button", { name: /^Path/i }));
    expect(rows()).toEqual(["a.ts", "z.ts"]);
    fireEvent.click(screen.getByRole("button", { name: /^Path/i }));
    expect(rows()).toEqual(["z.ts", "a.ts"]);
  });
});

describe("ReportOverview", () => {
  it("renders complete, partial, evidence-linked repository details", () => {
    const report: Report = {
      ...buildSampleReport(),
      partial: true,
      document_inventory: completeDocuments,
      project_profile: projectProfile,
      test_inventory: testInventory,
      architecture_insights: architectureInsights,
      commit_insights: commitInsights,
      run_commands: [
        { command: "npm test", source: "package.json", description: "Run tests" },
        { command: "npm run lint", source: "package.json" },
      ],
    };

    render(<ReportOverview report={report} />);

    expect(screen.getByRole("link", { name: report.repo_metadata.url })).toHaveAttribute(
      "rel",
      "noopener noreferrer"
    );
    expect(screen.getByText("Partial report (analysis timed out)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Documentation inventory" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Deep analysis" })).toBeInTheDocument();
    expect(screen.getByText(/npm test/i)).toBeInTheDocument();
    expect(screen.getByText(/Run tests/i)).toBeInTheDocument();
  });

  it("keeps uploaded and sparse repository metadata factual", () => {
    const report: Report = {
      ...buildSampleReport(),
      repo_metadata: {
        ...buildSampleReport().repo_metadata,
        url: "zip",
        analyzed_at: "not-a-date",
      },
      run_commands: [],
      candidate_brief: undefined,
    };
    delete report.document_inventory;

    render(<ReportOverview report={report} />);

    expect(screen.getByText("Uploaded ZIP")).toBeInTheDocument();
    expect(screen.getByText("not-a-date")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Run commands" })).not.toBeInTheDocument();
    expect(screen.getByText(/Deep analysis signals appear here/i)).toBeInTheDocument();
  });
});

describe("ReportDocument", () => {
  it("renders the full report document in export order", async () => {
    const report = buildSampleReport();
    render(<ReportDocument report={report} />);

    const headings = [
      "Repository",
      "Candidate Brief",
      "Folder Map",
      "Architecture Map",
      "Start Here",
      "Danger Zones",
      "Run & Contribute",
    ].map((name) => screen.getByRole("heading", { name, level: 2 }));

    for (let index = 1; index < headings.length; index += 1) {
      expect(headings[index - 1].compareDocumentPosition(headings[index])).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    }
    expect(screen.queryByText("Uploaded ZIP")).not.toBeInTheDocument();
    expect(screen.getByText(report.repo_metadata.url)).toBeInTheDocument();
    expect(await screen.findByText("Architecture graph contract")).toBeInTheDocument();
  });
});
