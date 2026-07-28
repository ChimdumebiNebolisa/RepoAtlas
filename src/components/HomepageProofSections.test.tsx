import React, { createRef } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSampleReport } from "@/lib/buildSampleReport";
import { candidateBriefWalkthroughOutputs } from "@/lib/candidateBriefContent";
import {
  homepageFaqItems,
  homepageInterviewGuides,
  homepageTrustBoundaries,
} from "@/lib/homepageContent";
import { buildHomepageSamplePreview } from "@/lib/homepageSamplePreview";
import { reportCapabilityCopy } from "@/lib/reportCapabilities";
import {
  HomepageHero,
  HomepageSampleProof,
  HomepageTrustAndFaq,
  HomepageWalkthroughOutcomes,
} from "./HomepageProofSections";

vi.mock("@/components/ReportTabs", () => ({
  ReportTabs: ({
    report,
    variant,
  }: {
    report: ReturnType<typeof buildSampleReport>;
    variant: string;
  }) => (
    <div data-testid="report-tabs">
      {variant} report for {report.repo_metadata.name}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
});

describe("HomepageHero", () => {
  it("renders a report-derived excerpt and starts the bundled sample", async () => {
    const user = userEvent.setup();
    const report = buildSampleReport();
    const preview = buildHomepageSamplePreview(report)!;
    const onGenerateSample = vi.fn();

    render(<HomepageHero sampleReport={report} onGenerateSample={onGenerateSample} />);

    expect(
      screen.getByRole("heading", {
        name: "Walk through the repository with file-backed talking points.",
      })
    ).toBeInTheDocument();
    expect(screen.getByTestId("sample-hero-card")).toHaveTextContent(
      preview.repositoryName
    );
    expect(screen.getByTestId("sample-hero-card")).toHaveTextContent(preview.walkthrough);
    expect(screen.getByTestId("sample-hero-card")).toHaveTextContent(
      preview.readingStep.path
    );
    expect(screen.getByTestId("sample-hero-card")).toHaveTextContent(
      preview.readingStep.evidence!.id
    );
    expect(screen.getByRole("link", { name: /Use your own repository/ })).toHaveAttribute(
      "href",
      "#analyze"
    );

    await user.click(screen.getByRole("button", { name: /Try bundled sample/ }));

    expect(onGenerateSample).toHaveBeenCalledOnce();
  });

  it("keeps an honest bundled-report fallback when preview evidence is unavailable", () => {
    const report = buildSampleReport();
    report.candidate_brief = undefined;

    render(<HomepageHero sampleReport={report} onGenerateSample={vi.fn()} />);

    expect(screen.queryByTestId("sample-hero-card")).not.toBeInTheDocument();
    expect(screen.getByText("Bundled Candidate Brief")).toBeInTheDocument();
    expect(
      screen.getByText("The complete sample report is available from the primary action.")
    ).toBeInTheDocument();
  });
});

describe("HomepageWalkthroughOutcomes", () => {
  it("renders the four established walkthrough outcomes and dependable export promise", () => {
    render(<HomepageWalkthroughOutcomes />);

    const section = screen.getByTestId("walkthrough-outcomes");
    const articles = within(section).getAllByRole("article");

    expect(articles).toHaveLength(candidateBriefWalkthroughOutputs.length);
    candidateBriefWalkthroughOutputs.forEach(({ title, description }, index) => {
      expect(articles[index]).toHaveTextContent(String(index + 1).padStart(2, "0"));
      expect(within(articles[index]).getByRole("heading", { name: title })).toBeInTheDocument();
      expect(articles[index]).toHaveTextContent(description);
    });
    expect(section).toHaveTextContent(reportCapabilityCopy.homepageBriefExports);
  });
});

describe("HomepageSampleProof", () => {
  it("renders the collapsed report-derived proof and opens the full sample", async () => {
    const user = userEvent.setup();
    const report = buildSampleReport();
    const preview = buildHomepageSamplePreview(report)!;
    const onOpenSample = vi.fn();

    render(
      <HomepageSampleProof
        sampleReport={report}
        showSampleReport={false}
        onOpenSample={onOpenSample}
        sectionRef={createRef<HTMLElement>()}
      />
    );

    const proof = screen.getByTestId("homepage-sample-preview");
    expect(proof).toHaveTextContent(preview.summary);
    expect(proof).toHaveTextContent(preview.walkthrough);
    expect(proof).toHaveTextContent(preview.readingStep.path);
    expect(proof).toHaveTextContent(preview.readingStep.why);
    expect(proof).toHaveTextContent(preview.architecture.explanation);
    expect(
      within(proof).getByRole("heading", {
        name: preview.interviewerQuestion.question,
      })
    ).toBeInTheDocument();
    expect(proof).toHaveTextContent(preview.interviewerQuestion.rationale);
    [
      preview.readingStep.evidence,
      preview.architecture.evidence,
      preview.interviewerQuestion.evidence,
    ].forEach((evidence) => {
      expect(proof).toHaveTextContent(evidence!.id);
      if (evidence!.path) {
        expect(proof).toHaveTextContent(evidence!.path);
      }
    });

    await user.click(screen.getByRole("button", { name: /Open sample report/ }));

    expect(onOpenSample).toHaveBeenCalledOnce();
  });

  it("states the architecture limit and omits unsupported evidence in a sparse preview", () => {
    const report = buildSampleReport();
    const brief = report.candidate_brief!;
    brief.evidence_refs = brief.evidence_refs
      .filter((evidence) => evidence.kind !== "architecture")
      .map((evidence) => ({ ...evidence, path: undefined }));

    const { container } = render(
      <HomepageSampleProof
        sampleReport={report}
        showSampleReport={false}
        onOpenSample={vi.fn()}
        sectionRef={createRef<HTMLElement>()}
      />
    );

    expect(
      screen.getByText(
        "This sample does not contain enough supported dependency evidence for a system-flow claim."
      )
    ).toBeInTheDocument();
    expect(container.querySelectorAll(".sample-evidence-tag")).toHaveLength(2);
    expect(container.querySelectorAll(".sample-evidence-tag code")).toHaveLength(0);
  });

  it("offers the full report without inventing a walkthrough preview", () => {
    const report = buildSampleReport();
    report.candidate_brief = undefined;

    render(
      <HomepageSampleProof
        sampleReport={report}
        showSampleReport={false}
        onOpenSample={vi.fn()}
        sectionRef={createRef<HTMLElement>()}
      />
    );

    expect(screen.queryByTestId("homepage-sample-preview")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /does not contain enough evidence for a walkthrough preview/
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open sample report/ })).toBeEnabled();
  });

  it("renders the read-only report workspace in the open state", () => {
    const report = buildSampleReport();

    render(
      <HomepageSampleProof
        sampleReport={report}
        showSampleReport
        onOpenSample={vi.fn()}
        sectionRef={createRef<HTMLElement>()}
      />
    );

    expect(screen.queryByRole("button", { name: /Open sample report/ })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Explore the bundled read-only report. PDF and PNG preview exports work here; Markdown requires a saved analysis."
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId("report-tabs")).toHaveTextContent(
      `preview report for ${report.repo_metadata.name}`
    );
  });
});

describe("HomepageTrustAndFaq", () => {
  it("renders every trust boundary, guide route, and expandable FAQ answer", async () => {
    const user = userEvent.setup();

    render(<HomepageTrustAndFaq />);

    expect(screen.getByText(reportCapabilityCopy.homepageStorageNote)).toBeInTheDocument();
    homepageTrustBoundaries.forEach((boundary) => {
      expect(screen.getByText(boundary)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /Read the privacy details/ })).toHaveAttribute(
      "href",
      "/privacy"
    );
    const guideNav = screen.getByRole("navigation", {
      name: "Prepare for the walkthrough question.",
    });
    homepageInterviewGuides.forEach(({ title, description, href }) => {
      const link = within(guideNav).getByRole("link", { name: title });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveTextContent(description);
    });

    const faqItems = screen.getAllByTestId("homepage-faq-item");
    expect(faqItems).toHaveLength(homepageFaqItems.length);
    for (const [index, { question, answer, link }] of homepageFaqItems.entries()) {
      const item = faqItems[index];
      expect(within(item).getByRole("heading", { name: question })).toBeInTheDocument();
      expect(item).not.toHaveAttribute("open");
      await user.click(within(item).getByText(question));
      expect(item).toHaveAttribute("open");
      expect(item).toHaveTextContent(answer);
      if (link) {
        expect(within(item).getByRole("link", { name: link.label })).toHaveAttribute(
          "href",
          link.href,
        );
      }
    }
  });
});
