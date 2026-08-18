import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InterviewPreparationPage, { metadata } from "./page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const canonicalUrl = "https://repo-atlas-phi.vercel.app/interview-preparation";

afterEach(cleanup);

describe("interview preparation page", () => {
  it("publishes self-canonical interview-preparation metadata", () => {
    expect(metadata.title).toBe("Code Interview Preparation with a Candidate Brief | RepoAtlas");
    expect(metadata.alternates).toEqual({ canonical: canonicalUrl });
    expect(metadata.openGraph).toMatchObject({ type: "website", url: canonicalUrl });
    expect(metadata.robots).toBeUndefined();
  });

  it("answers the walkthrough question with inspectable public proof", () => {
    render(<InterviewPreparationPage />);

    expect(
      screen.getByRole("heading", { name: "Start with the route you can prove." }),
    ).toBeInTheDocument();
    const method = screen.getByRole("list", {
      name: "Evidence-first repository walkthrough method",
    });
    for (const step of [
      "Identify entry points.",
      "Establish a reading order.",
      "Inspect architecture and risk signals.",
      "Prepare file-backed talking points.",
    ]) {
      expect(method).toHaveTextContent(step);
    }
    expect(
      screen.getByRole("link", { name: "Inspect the exact-commit FastAPI Candidate Brief" }),
    ).toHaveAttribute("href", "/examples/fastapi-candidate-brief");
    expect(
      screen.getByRole("link", {
        name: "Practice code review interview questions with a worked example",
      }),
    ).toHaveAttribute("href", "/code-review-interview");
  });

  it("keeps one primary Candidate Brief action", () => {
    render(<InterviewPreparationPage />);

    const primaryActions = screen.getAllByRole("link").filter((link) =>
      link.classList.contains("btn-primary"),
    );
    expect(primaryActions).toHaveLength(1);
    expect(primaryActions[0]).toHaveAccessibleName("Prepare my Candidate Brief");
    expect(primaryActions[0]).toHaveAttribute("href", "/?source=interview_preparation#analyze");
  });
});
