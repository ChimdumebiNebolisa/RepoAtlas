import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EvidenceRef } from "@/types/report";
import { EvidenceList } from "./EvidenceLinks";

afterEach(cleanup);

function evidence(overrides: Partial<EvidenceRef> = {}): EvidenceRef {
  return {
    id: "entry-1",
    kind: "file",
    label: "Application entry point",
    ...overrides,
  };
}

describe("EvidenceList", () => {
  it("opens complete evidence through a tooltip that preserves its available context", async () => {
    const ref = evidence({
      path: "src/app/page.tsx",
      detail: "Handles the primary request flow",
      snippet: "export default function Home()",
    });
    const onNavigate = vi.fn();

    render(
      <EvidenceList
        ids={[ref.id]}
        evidenceById={new Map([[ref.id, ref]])}
        onNavigate={onNavigate}
      />
    );

    const link = screen.getByRole("button", { name: ref.id });
    expect(link).toHaveAttribute(
      "title",
      [
        ref.label,
        ref.path,
        ref.detail,
        ref.snippet,
      ].join(" · ")
    );

    await userEvent.click(link);

    expect(onNavigate).toHaveBeenCalledOnce();
    expect(onNavigate).toHaveBeenCalledWith(ref.id);
  });

  it("falls back to the identifier for sparse evidence and stays safe without navigation", async () => {
    const ref = evidence({ id: "sparse-1", label: "" });

    render(<EvidenceList ids={[ref.id]} evidenceById={new Map([[ref.id, ref]])} />);

    const link = screen.getByRole("button", { name: ref.id });
    expect(link).toHaveAttribute("title", ref.id);

    await expect(userEvent.click(link)).resolves.toBeUndefined();
  });

  it("hides missing identifiers, deduplicates matches, and uses bounded demo labels", () => {
    const ref = evidence({ id: "demo-1" });

    const { rerender } = render(
      <EvidenceList
        ids={[ref.id, "missing-1", ref.id]}
        evidenceById={new Map([[ref.id, ref]])}
        demoMode
      />
    );

    expect(screen.getAllByRole("button", { name: "evidence" })).toHaveLength(1);
    expect(screen.queryByText("missing-1")).not.toBeInTheDocument();

    rerender(
      <EvidenceList
        ids={["missing-1"]}
        evidenceById={new Map([[ref.id, ref]])}
        demoMode
      />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
