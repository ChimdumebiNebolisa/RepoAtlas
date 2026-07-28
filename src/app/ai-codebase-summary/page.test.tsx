import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import sitemap from "../sitemap";
import AiCodebaseSummaryPage, { metadata } from "./page";

const canonicalUrl = "https://repo-atlas-phi.vercel.app/ai-codebase-summary";

afterEach(cleanup);

describe("AI codebase summary comparison page", () => {
  it("publishes a self-canonical, indexable comparison entrance", () => {
    expect(metadata.title).toBe("AI Codebase Summary vs. Evidence-Linked Brief | RepoAtlas");
    expect(metadata.description).toContain("AI codebase summary");
    expect(metadata.alternates).toEqual({ canonical: canonicalUrl });
    expect(metadata.openGraph).toMatchObject({ type: "article", url: canonicalUrl });
    expect(metadata.robots).toBeUndefined();
    expect(sitemap()).toContainEqual({
      url: canonicalUrl,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  });

  it("compares outputs without making universal claims about AI tools", () => {
    render(<AiCodebaseSummaryPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "AI summary or evidence-linked interview brief?",
    );
    expect(screen.getByText(/depend on the product you choose/)).toBeInTheDocument();
    expect(screen.getByText(/do not share one feature set or privacy model/)).toBeInTheDocument();
    expect(screen.getByText(/does not call AI or execute uploaded code/)).toBeInTheDocument();
    expect(screen.getByText(/They are not bug, vulnerability, or runtime findings/)).toBeInTheDocument();
  });

  it("keeps one primary sample action and links both supporting guides", () => {
    render(<AiCodebaseSummaryPage />);

    const primaryActions = screen.getAllByRole("link").filter((link) =>
      link.classList.contains("btn-primary"),
    );
    expect(primaryActions).toHaveLength(1);
    expect(primaryActions[0]).toHaveAttribute("href", "/?source=interview_preparation#analyze");

    expect(screen.getByRole("link", { name: /learn the complete evidence-first walkthrough/i })).toHaveAttribute(
      "href",
      "/repository-walkthrough-interview",
    );
    expect(screen.getByRole("link", { name: /add contribution, rationale, and outcomes/i })).toHaveAttribute(
      "href",
      "/how-to-walk-through-a-project-in-an-interview",
    );
  });

  it("covers the required verification and product-choice questions", () => {
    render(<AiCodebaseSummaryPage />);

    const matrix = screen.getByRole("table", {
      name: "AI summary and Candidate Brief comparison",
    });
    expect(within(matrix).getByRole("rowheader", { name: "Source traceability" })).toBeInTheDocument();
    expect(within(matrix).getByRole("rowheader", { name: "Limits" })).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Entry point" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Architecture" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Risk signal" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Testing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Technical choice" })).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Code execution" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Data handling" })).toBeInTheDocument();
    expect(screen.getByText(/authorship, the reason behind a decision/)).toBeInTheDocument();
  });
});
