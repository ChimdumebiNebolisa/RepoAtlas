import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import sitemap from "../../sitemap";
import FastApiCandidateBriefExamplePage, { metadata } from "./page";

const canonicalUrl = "https://repo-atlas-phi.vercel.app/examples/fastapi-candidate-brief";

afterEach(cleanup);

describe("FastAPI Candidate Brief example", () => {
  it("publishes a self-canonical public example", () => {
    expect(metadata.title).toBe("FastAPI Candidate Brief Example | RepoAtlas");
    expect(metadata.alternates).toEqual({ canonical: canonicalUrl });
    expect(metadata.openGraph).toMatchObject({ type: "article", url: canonicalUrl });
    expect(sitemap()).toContainEqual({
      url: canonicalUrl,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  });

  it("shows exact captured output and its evidence boundary", () => {
    render(<FastApiCandidateBriefExamplePage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "A Candidate Brief for FastAPI's full-stack template.",
    );
    expect(screen.getByText("c350936d2888ef16ff4f5549684fd8db54935a89")).toBeInTheDocument();
    expect(screen.getByText("Python project")).toBeInTheDocument();
    expect(screen.getByText(/12 ranked starting files, 133 structural risk signals/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "backend/app/api/main.py" })).toHaveAttribute(
      "href",
      expect.stringContaining("/blob/c350936d2888ef16ff4f5549684fd8db54935a89/backend/app/api/main.py"),
    );
    expect(screen.getByText(/did not promote the dependency name into a framework classification/)).toBeInTheDocument();
    expect(screen.getByText(/204 TypeScript and JavaScript import edges remained unresolved/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Turn this report into an interview walkthrough" }),
    ).toHaveAttribute("href", "/repository-walkthrough-interview");
    expect(
      screen.getByRole("link", { name: "Run your public GitHub repository" }),
    ).toHaveAttribute("href", "/?source=fastapi_example#analyze");
  });
});
