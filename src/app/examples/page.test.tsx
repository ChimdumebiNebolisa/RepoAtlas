import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import sitemap from "../sitemap";
import ExamplesGalleryPage, { metadata, TOOL_PAGE_WORD_CAP } from "./page";

const canonicalUrl = "https://repo-atlas-phi.vercel.app/examples";

const examples = [
  {
    repository: "fastapi/full-stack-fastapi-template",
    language: "Python",
    commit: "c350936",
    linkName: "Open FastAPI Candidate Brief",
    href: "/examples/fastapi-candidate-brief",
  },
  {
    repository: "pallets/click",
    language: "Python",
    commit: "2c8cd3a",
    linkName: "Open Pallets Click Candidate Brief",
    href: "/examples/click-candidate-brief",
  },
  {
    repository: "spring-projects/spring-petclinic",
    language: "Java",
    commit: "88e37c1",
    linkName: "Open Spring Petclinic Candidate Brief",
    href: "/examples/spring-petclinic-candidate-brief",
  },
  {
    repository: "sindresorhus/p-limit",
    language: "JavaScript and TypeScript",
    commit: "df47604",
    linkName: "Open p-limit Candidate Brief",
    href: "/examples/p-limit-javascript-candidate-brief",
  },
] as const;

afterEach(cleanup);

describe("Candidate Brief examples gallery", () => {
  it("publishes a self-canonical, discoverable gallery", () => {
    expect(metadata.title).toBe("Candidate Brief Examples by Language | RepoAtlas");
    expect(metadata.alternates).toEqual({ canonical: canonicalUrl });
    expect(metadata.openGraph).toMatchObject({ type: "website", url: canonicalUrl });
    expect(metadata.robots).toBeUndefined();
    expect(sitemap()).toContainEqual({
      url: canonicalUrl,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  });

  it("lists every live exact-commit brief once in one internal-link group", () => {
    const { container } = render(<ExamplesGalleryPage />);
    const linkGroups = container.querySelectorAll("[data-internal-link-group]");

    expect(linkGroups).toHaveLength(1);
    const gallery = within(linkGroups[0] as HTMLElement);
    expect(gallery.getAllByRole("link")).toHaveLength(examples.length);

    for (const example of examples) {
      const link = gallery.getByRole("link", { name: example.linkName });
      const entry = link.closest("article");

      expect(entry).not.toBeNull();

      const scopedEntry = within(entry as HTMLElement);
      expect(scopedEntry.getByText(example.repository)).toBeInTheDocument();
      expect(scopedEntry.getByText(example.language)).toBeInTheDocument();
      expect(scopedEntry.getByText(`Exact commit · ${example.commit}`)).toBeInTheDocument();
      expect(link).toHaveAttribute("href", example.href);
    }
  });

  it("keeps one primary browse action and stays inside the tool-page word cap", () => {
    const { container } = render(<ExamplesGalleryPage />);
    const primaryActions = container.querySelectorAll(".report-action-primary");
    const bodyText = screen.getByTestId("examples-body").textContent ?? "";
    const bodyWordCount = bodyText.trim().split(/\s+/u).filter(Boolean).length;

    expect(primaryActions).toHaveLength(1);
    expect(primaryActions[0]).toHaveAttribute("href", "#briefs");
    expect(bodyWordCount).toBeLessThanOrEqual(TOOL_PAGE_WORD_CAP);
  });
});
