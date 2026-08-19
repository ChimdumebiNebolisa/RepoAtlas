import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CandidateBriefSampleNextStep } from "./CandidateBriefSampleNextStep";

afterEach(cleanup);

describe("CandidateBriefSampleNextStep", () => {
  it("offers one clear path from the sample to a public GitHub repository", async () => {
    const user = userEvent.setup();
    const onAnalyzeRepository = vi.fn();
    render(<CandidateBriefSampleNextStep onAnalyzeRepository={onAnalyzeRepository} />);

    expect(
      screen.getByRole("heading", { name: "Now map a repository you need to explain." })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);

    await user.click(
      screen.getByRole("button", { name: "Analyze my public GitHub repository" })
    );
    expect(onAnalyzeRepository).toHaveBeenCalledOnce();
  });
});
