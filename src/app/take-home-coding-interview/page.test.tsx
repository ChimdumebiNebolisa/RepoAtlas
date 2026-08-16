import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import sitemap from "../sitemap";
import TakeHomeCodingInterviewPage, { metadata } from "./page";

const canonicalUrl = "https://repo-atlas-phi.vercel.app/take-home-coding-interview";

afterEach(cleanup);

describe("take-home coding interview guide", () => {
  it("publishes a self-canonical, indexable editorial entrance", () => {
    expect(metadata.title).toBe("Take-home Coding Interview Review Guide | RepoAtlas");
    expect(metadata.description).toContain("Review a take-home coding assignment");
    expect(metadata.alternates).toEqual({ canonical: canonicalUrl });
    expect(metadata.openGraph).toMatchObject({ type: "article", url: canonicalUrl });
    expect(metadata.robots).toBeUndefined();
    expect(sitemap()).toContainEqual({
      url: canonicalUrl,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  });

  it("teaches a bounded five-pass review method", () => {
    render(<TakeHomeCodingInterviewPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Review your take-home before you explain it.",
    );
    expect(screen.getByText("Restate the constraint.")).toBeInTheDocument();
    expect(screen.getByText("Walk one complete path.")).toBeInTheDocument();
    expect(screen.getByText("Explain one decision.")).toBeInTheDocument();
    expect(screen.getByText("Show the protection.")).toBeInTheDocument();
    expect(screen.getByText("Name the next change.")).toBeInTheDocument();
    expect(screen.getByText(/cannot prove runtime behavior/)).toBeInTheDocument();
  });

  it("keeps one primary action and connects proof plus related guides", () => {
    render(<TakeHomeCodingInterviewPage />);

    const links = screen.getAllByRole("link");
    const primaryActions = links.filter((link) => link.classList.contains("btn-primary"));
    expect(primaryActions).toHaveLength(1);
    expect(primaryActions[0]).toHaveAttribute(
      "href",
      "/?source=interview_preparation&sample=1#analyze",
    );
    expect(screen.getByRole("link", { name: /Use a public GitHub repository/i })).toHaveAttribute(
      "href",
      "/?source=interview_preparation#analyze",
    );
    expect(screen.getByRole("link", { name: /Inspect the FastAPI Candidate Brief/i })).toHaveAttribute(
      "href",
      "/examples/fastapi-candidate-brief",
    );
    expect(screen.getByRole("link", { name: /unfamiliar repository walkthrough/i })).toHaveAttribute(
      "href",
      "/repository-walkthrough-interview",
    );
    expect(screen.getByRole("link", { name: /personal project walkthrough/i })).toHaveAttribute(
      "href",
      "/how-to-walk-through-a-project-in-an-interview",
    );
  });
});
