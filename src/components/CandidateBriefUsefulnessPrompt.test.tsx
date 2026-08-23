import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildCandidateBriefUsefulnessMailto,
  CandidateBriefUsefulnessPrompt,
} from "./CandidateBriefUsefulnessPrompt";

afterEach(cleanup);

describe("CandidateBriefUsefulnessPrompt", () => {
  it("keeps feedback optional until a candidate chooses a section", () => {
    render(<CandidateBriefUsefulnessPrompt />);

    expect(
      screen.getByRole("heading", {
        name: "Which section would you use in an interview or code discussion?",
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open feedback message" })).toBeDisabled();
    expect(screen.getByText(/Do not include repository names, links, or source content/i))
      .toBeInTheDocument();
  });

  it("opens a bounded support draft with the selected section and optional comment", async () => {
    const user = userEvent.setup();
    render(<CandidateBriefUsefulnessPrompt />);

    await user.selectOptions(screen.getByLabelText("Section"), "Reading Path");
    await user.type(screen.getByLabelText("Optional comment"), "  I would use this first.  ");

    const link = screen.getByRole("link", { name: "Open feedback message" });
    const href = link.getAttribute("href") ?? "";
    const url = new URL(href);

    expect(url.protocol).toBe("mailto:");
    expect(url.pathname).toBe("repo-atlas-phi@mail.tin.computer");
    expect(url.searchParams.get("subject")).toBe("RepoAtlas Candidate Brief feedback");
    expect(url.searchParams.get("body")).toBe(
      "Which section would you use in an interview or code discussion?\n\n" +
        "Section: Reading Path\nComment: I would use this first."
    );
  });

  it("never adds repository details to the generated message", () => {
    const href = buildCandidateBriefUsefulnessMailto("Evidence", "Useful citations");

    expect(decodeURIComponent(href)).not.toContain("github.com");
    expect(decodeURIComponent(href)).not.toContain("src/");
    expect(decodeURIComponent(href)).not.toContain("repository name");
    expect(new URL(href).searchParams.get("body")).toBe(
      "Which section would you use in an interview or code discussion?\n\n" +
        "Section: Evidence\nComment: Useful citations"
    );
  });
});
