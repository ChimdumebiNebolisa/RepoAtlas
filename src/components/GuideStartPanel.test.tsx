import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuideStartPanel } from "@/components/GuideStartPanel";

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
      "/?source=interview_preparation#analyze",
    );
    expect(sampleAction).toHaveClass("btn", "btn-primary", "guide-start-primary");
    expect(githubAction).toHaveAttribute(
      "href",
      "/?source=interview_preparation#analyze",
    );
    expect(githubAction).not.toHaveClass("btn", "btn-primary");
  });
});
