import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import sitemap from "../sitemap";
import CodebaseInterviewPreparationPage, { metadata } from "./page";

const canonicalUrl = "https://repo-atlas-phi.vercel.app/codebase-interview-preparation";

afterEach(cleanup);

describe("codebase interview preparation page", () => {
  it("publishes a self-canonical, indexable comparison entrance", () => {
    expect(metadata.title).toBe("Structured Codebase Interview Preparation | RepoAtlas");
    expect(metadata.description).toContain("structured, evidence-first codebase interview preparation");
    expect(metadata.alternates).toEqual({ canonical: canonicalUrl });
    expect(metadata.openGraph).toMatchObject({ type: "article", url: canonicalUrl });
    expect(metadata.robots).toBeUndefined();
    expect(sitemap()).toContainEqual({
      url: canonicalUrl,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  });

  it("compares both preparation modes before introducing the product boundary", () => {
    render(<CodebaseInterviewPreparationPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Prepare a route through the code, not a pile of notes.",
    );
    expect(screen.getByText("Ad hoc browsing works when")).toBeInTheDocument();
    expect(screen.getByText("A structured pass helps when")).toBeInTheDocument();
    expect(screen.getByText(/The methods are not rivals/)).toBeInTheDocument();
    expect(screen.getByText(/does not execute code or call AI/)).toBeInTheDocument();
    expect(screen.getByText(/not confirmed defects or vulnerabilities/)).toBeInTheDocument();
  });

  it("keeps one primary sample action and links both supporting guides", () => {
    render(<CodebaseInterviewPreparationPage />);

    const primaryActions = screen.getAllByRole("link").filter((link) =>
      link.classList.contains("btn-primary"),
    );
    expect(primaryActions).toHaveLength(1);
    expect(primaryActions[0]).toHaveAttribute(
      "href",
      "/?source=comparison_structured_preparation#analyze",
    );

    expect(screen.getAllByRole("link", { name: /repository walkthrough interview guide/i })[0]).toHaveAttribute(
      "href",
      "/repository-walkthrough-interview",
    );
    expect(screen.getByRole("link", { name: /explain what you built and why/i })).toHaveAttribute(
      "href",
      "/how-to-walk-through-a-project-in-an-interview",
    );
  });
});
