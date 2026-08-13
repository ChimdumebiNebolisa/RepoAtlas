import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuideStartPanel } from "@/components/GuideStartPanel";
import { candidateBriefProofPromise } from "@/lib/candidateBriefContent";

vi.mock("@/lib/productAnalytics", () => ({
  captureProductEvent: vi.fn(),
}));

afterEach(cleanup);

describe("GuideStartPanel", () => {
  it("keeps the bundled sample primary and the public GitHub route secondary", () => {
    render(<GuideStartPanel />);

    const panel = screen.getByRole("complementary", {
      name: "Start a repository walkthrough",
    });
    const sampleAction = within(panel).getByRole("link", {
      name: "Run the bundled sample",
    });
    const githubAction = within(panel).getByRole("link", {
      name: "Use a public GitHub repository",
    });

    expect(sampleAction).toHaveAttribute(
      "href",
      "/?source=interview_preparation&sample=1#analyze",
    );
    expect(sampleAction).toHaveClass("btn", "btn-primary", "guide-start-primary");
    expect(githubAction).toHaveAttribute(
      "href",
      "/?source=interview_preparation#analyze",
    );
    expect(githubAction).not.toHaveClass("btn", "btn-primary");
  });

  it("states the authored-project evidence boundary without changing the action hierarchy", () => {
    render(
      <GuideStartPanel
        ariaLabel="Start an authored-project brief"
        heading="Add the file-backed structure."
        description={`${candidateBriefProofPromise} You supply the rationale, constraints, and outcomes.`}
      />,
    );

    const panel = screen.getByRole("complementary", {
      name: "Start an authored-project brief",
    });

    expect(panel).toHaveTextContent(
      candidateBriefProofPromise,
    );
    expect(panel).toHaveTextContent(
      "You supply the rationale, constraints, and outcomes.",
    );
    expect(
      within(panel).getByRole("link", { name: "Run the bundled sample" }),
    ).toHaveClass("btn-primary");
    expect(
      within(panel).getByRole("link", {
        name: "Use a public GitHub repository",
      }),
    ).not.toHaveClass("btn-primary");
  });
});
