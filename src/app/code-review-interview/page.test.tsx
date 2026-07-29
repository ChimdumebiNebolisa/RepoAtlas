import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import sitemap from "../sitemap";
import CodeReviewInterviewPage, { metadata } from "./page";

const canonicalUrl = "https://repo-atlas-phi.vercel.app/code-review-interview";

afterEach(cleanup);

describe("code review interview guide", () => {
  it("publishes a self-canonical, indexable editorial entrance", () => {
    expect(metadata.title).toBe(
      "Code Review Interview Examples and Preparation Guide | RepoAtlas",
    );
    expect(metadata.description).toContain("code review interview examples");
    expect(metadata.alternates).toEqual({ canonical: canonicalUrl });
    expect(metadata.openGraph).toMatchObject({ type: "article", url: canonicalUrl });
    expect(metadata.robots).toBeUndefined();
    expect(sitemap()).toContainEqual({
      url: canonicalUrl,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  });

  it("teaches a complete evidence-first review method with a worked example", () => {
    render(<CodeReviewInterviewPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Review the behavior, then explain your judgment.",
    );
    expect(screen.getAllByText("Establish the contract")).toHaveLength(1);
    expect(screen.getByText("Trace one complete path")).toBeInTheDocument();
    expect(screen.getByLabelText("TypeScript code review exercise")).toHaveTextContent(
      "saveInvite",
    );
    expect(screen.getByText("The input contract is not enforced")).toBeInTheDocument();
    expect(screen.getByText("A failed write can be reported as success")).toBeInTheDocument();
    expect(screen.getByText("Normalization happens after the duplicate check")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What would you test?" })).toBeInTheDocument();
    expect(screen.getByText(/does not execute the code or call AI/)).toBeInTheDocument();
  });

  it("keeps the complete guide section hierarchy in its established order", () => {
    render(<CodeReviewInterviewPage />);

    expect(
      Array.from(
        document.querySelectorAll<HTMLElement>(
          "article [id^='code-review-'][id$='-heading']",
        ),
        (heading) => heading.id,
      ),
    ).toEqual([
      "code-review-format-heading",
      "code-review-method-heading",
      "code-review-example-heading",
      "code-review-findings-heading",
      "code-review-priority-heading",
      "code-review-questions-heading",
      "code-review-close-heading",
    ]);
  });

  it("keeps one primary action and connects the surrounding preparation cluster", () => {
    render(<CodeReviewInterviewPage />);

    const links = screen.getAllByRole("link");
    const primaryActions = links.filter((link) => link.classList.contains("btn-primary"));
    expect(primaryActions).toHaveLength(1);
    expect(primaryActions[0]).toHaveAttribute(
      "href",
      "/?source=interview_preparation#analyze",
    );
    expect(screen.getByRole("link", { name: /Use a public GitHub repository/i })).toHaveAttribute(
      "href",
      "/?source=interview_preparation#analyze",
    );
    expect(links.some((link) => link.getAttribute("href") === "/repository-walkthrough-interview")).toBe(
      true,
    );
    expect(links.some((link) => link.getAttribute("href") === "/codebase-interview-preparation")).toBe(
      true,
    );
  });
});
