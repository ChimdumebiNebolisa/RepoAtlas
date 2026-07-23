import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { EvidenceRef } from "@/types/report";
import { CandidateBriefEvidence } from "./CandidateBriefEvidence";

afterEach(cleanup);

function evidence(overrides: Partial<EvidenceRef> = {}): EvidenceRef {
  return {
    id: "sem-1",
    kind: "architecture",
    label: "Import @/lib/report",
    ...overrides,
  };
}

describe("CandidateBriefEvidence", () => {
  it("shows complete file-backed evidence with its location, detail, snippet, and usage", () => {
    const ref = evidence({
      path: "src/app/page.tsx",
      line_start: 24,
      line_end: 24,
      detail: "import → src/lib/report.ts",
      snippet: 'import { buildReport } from "@/lib/report";',
    });

    render(
      <CandidateBriefEvidence
        grouped={{ architecture: [ref] }}
        usedBy={new Map([[ref.id, ["30-second walkthrough", "Architecture answer"]]])}
      />
    );

    const card = document.getElementById(`evidence-${ref.id}`);
    expect(card).not.toBeNull();
    expect(card).toHaveClass("min-w-0");
    const location = within(card!).getByText("src/app/page.tsx:24");
    expect(location).toBeInTheDocument();
    expect(location).toHaveClass("break-words");
    expect(within(card!).getByText("import → src/lib/report.ts")).toBeInTheDocument();
    expect(within(card!).getByText(ref.snippet!)).toBeInTheDocument();
    expect(within(card!).getByText("Used by: 30-second walkthrough, Architecture answer"))
      .toBeInTheDocument();
  });

  it("keeps sparse evidence readable when no location or optional context exists", () => {
    const ref = evidence({
      id: "arch-1",
      label: "Architecture graph summary",
    });

    render(
      <CandidateBriefEvidence grouped={{ architecture: [ref] }} usedBy={new Map()} />
    );

    expect(screen.getByText("Architecture graph summary")).toBeInTheDocument();
    expect(screen.queryByText(/^Used by:/)).not.toBeInTheDocument();
    expect(document.querySelector(`#evidence-${ref.id} pre`)).toBeNull();
  });

  it("renders multiple groups and paths without line numbers in their established order", () => {
    const pathOnly = evidence({
      id: "start-1",
      kind: "start_here",
      label: "Reading candidate: README.md",
      path: "README.md",
    });
    const warning = evidence({
      id: "warn-1",
      kind: "warning",
      label: "Analysis warning 1",
      detail: "Some imports could not be resolved.",
    });

    render(
      <CandidateBriefEvidence
        grouped={{ start_here: [pathOnly], warning: [warning] }}
        usedBy={new Map([[warning.id, []]])}
      />
    );

    expect(screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent))
      .toEqual(["start_here", "warning"]);
    expect(screen.getByText("README.md")).toBeInTheDocument();
    expect(screen.queryByText("README.md:")).not.toBeInTheDocument();
    expect(screen.getByText("Some imports could not be resolved.")).toBeInTheDocument();
    expect(screen.queryByText(/^Used by:/)).not.toBeInTheDocument();
  });
});
