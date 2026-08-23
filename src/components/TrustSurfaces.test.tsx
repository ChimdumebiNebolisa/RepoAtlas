import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ContactPage, { metadata as contactMetadata } from "@/app/contact/page";
import PrivacyPage, { metadata as privacyMetadata } from "@/app/privacy/page";
import TermsPage, { metadata as termsMetadata } from "@/app/terms/page";
import { InfoPage } from "@/components/InfoPage";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const supportAddress = "repo-atlas-phi@mail.tin.computer";

afterEach(cleanup);

describe("public trust surfaces", () => {
  it("keeps the shared header identity and established capability boundaries", () => {
    render(<SiteHeader />);

    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: /RepoAtlas/i })).toHaveAttribute(
      "href",
      "/",
    );
    expect(within(header).getByText("Candidate Brief Generator")).toBeInTheDocument();
    expect(
      within(header).getByLabelText("Product capabilities"),
    ).toHaveTextContent("No AI required");
    expect(header).not.toHaveTextContent(/pricing/i);
  });

  it("keeps the shared footer navigation and processing boundary without third-party attribution", () => {
    render(<SiteFooter />);

    const footer = screen.getByRole("contentinfo");
    const navigation = within(footer).getByRole("navigation", {
      name: "Footer navigation",
    });
    expect(within(navigation).getByRole("link", { name: "Interview prep" })).toHaveAttribute(
      "href",
      "/interview-preparation",
    );
    expect(within(navigation).getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(within(navigation).getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(within(navigation).getByRole("link", { name: "Contact" })).toHaveAttribute(
      "href",
      "/contact",
    );
    expect(footer).toHaveTextContent(
      "Deterministic repository analysis. No code execution. No AI calls.",
    );
    expect(within(footer).queryByRole("link", { name: "Growth by Tin" })).not.toBeInTheDocument();
    expect(footer).not.toHaveTextContent(/pricing/i);
  });

  it("renders the information-page shell across paragraph, list, and empty section states", () => {
    render(
      <InfoPage
        eyebrow="Trust center"
        title="Repository boundaries"
        introduction="Inspect the exact product boundaries."
        sections={[
          {
            title: "Processing",
            paragraphs: ["Repository files stay evidence-linked."],
            items: ["No code execution.", "No AI calls."],
          },
          {
            title: "Empty state",
          },
        ]}
      />,
    );

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("article")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Repository boundaries" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
    expect(screen.getByRole("list")).toHaveTextContent("No code execution.");
    expect(screen.getByRole("link", { name: /RepoAtlas/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("keeps the Privacy route metadata, repository handling, and support contact exact", () => {
    render(<PrivacyPage />);

    expect(privacyMetadata.title).toBe("Privacy | RepoAtlas");
    expect(screen.getByRole("heading", { level: 1, name: "Privacy" })).toBeInTheDocument();
    expect(screen.getByText(/does not execute repository code or send it to an AI service/i))
      .toBeInTheDocument();
    expect(screen.getByText(new RegExp(supportAddress))).toBeInTheDocument();
    expect(screen.getByRole("main")).not.toHaveTextContent(/pricing/i);
  });

  it("keeps the Terms route metadata and evidence-bounded output guidance exact", () => {
    render(<TermsPage />);

    expect(termsMetadata.title).toBe("Terms | RepoAtlas");
    expect(
      screen.getByRole("heading", { level: 1, name: "Terms of use" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/deterministic analysis from the repository evidence/i))
      .toBeInTheDocument();
    expect(screen.getByText(/not security audits, vulnerability findings/i))
      .toBeInTheDocument();
    expect(screen.getByText(new RegExp(supportAddress))).toBeInTheDocument();
    expect(screen.getByRole("main")).not.toHaveTextContent(/pricing/i);
  });

  it("keeps the Contact route metadata, support address, and safe-contact guidance exact", () => {
    render(<ContactPage />);

    expect(contactMetadata.title).toBe("Contact | RepoAtlas");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Talk to a person about RepoAtlas.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: supportAddress })).toHaveAttribute(
      "href",
      `mailto:${supportAddress}`,
    );
    expect(screen.getByText(/do not email repository files or sensitive code/i))
      .toBeInTheDocument();
    expect(screen.getByRole("main")).not.toHaveTextContent(/pricing/i);
  });
});
