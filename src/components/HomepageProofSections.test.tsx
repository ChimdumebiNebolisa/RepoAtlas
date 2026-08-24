import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  homepageFaqItems,
  homepageTrustBoundaries,
} from "@/lib/homepageContent";
import { reportCapabilityCopy } from "@/lib/reportCapabilities";
import {
  HomepageHero,
  HomepageTrustAndFaq,
} from "./HomepageProofSections";

afterEach(() => {
  cleanup();
});

describe("HomepageHero", () => {
  it("leads with the outcome and starts the bundled sample", async () => {
    const user = userEvent.setup();
    const onGenerateSample = vi.fn();

    render(<HomepageHero loading={false} onGenerateSample={onGenerateSample} />);

    expect(
      screen.getByRole("heading", {
        name: "Turn a repository into an interview-ready brief.",
      })
    ).toBeInTheDocument();
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(
      screen.queryByRole("link", { name: /Analyze your repository/ })
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Open the sample Candidate Brief/ })
    );

    expect(onGenerateSample).toHaveBeenCalledOnce();
  });

  it("disables the only action while the sample is opening", () => {
    render(<HomepageHero loading onGenerateSample={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Opening sample/ })).toBeDisabled();
  });
});

describe("HomepageTrustAndFaq", () => {
  it("renders every trust boundary and expandable FAQ answer without a guide nav", async () => {
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
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();

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
