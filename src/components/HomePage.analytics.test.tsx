import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildSampleReport } from "@/lib/buildSampleReport";

const captureReportViewed = vi.hoisted(() => vi.fn());
const captureWalkthroughCopied = vi.hoisted(() => vi.fn());

vi.mock("@/lib/productAnalytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/productAnalytics")>();
  return {
    ...actual,
    captureReportViewed,
    captureWalkthroughCopied,
  };
});

vi.mock("@/components/HomepageProofSections", () => ({
  HomepageHero: () => null,
  HomepageSampleProof: () => null,
  HomepageTrustAndFaq: () => null,
  HomepageWalkthroughOutcomes: () => null,
}));

import { HomePage } from "./HomePage";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";

describe("HomePage walkthrough analytics journeys", () => {
  beforeEach(() => {
    captureReportViewed.mockReset();
    captureWalkthroughCopied.mockReset();
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    vi.stubGlobal(
      "IntersectionObserver",
      class MockIntersectionObserver {
        private callback: IntersectionObserverCallback;

        constructor(callback: IntersectionObserverCallback) {
          this.callback = callback;
        }

        observe(target: Element) {
          this.callback(
            [{ isIntersecting: true, target } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver
          );
        }

        disconnect() {}
        unobserve() {}
        takeRecords() { return []; }
        root = null;
        rootMargin = "0px";
        thresholds = [0];
      }
    );
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    cleanup();
  });

  it.each(["sample", "github", "zip"] as const)(
    "records one view and one confirmed copy after the %s journey",
    async (source) => {
      const report = buildSampleReport();
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            reportId: REPORT_ID,
            report,
            persisted: false,
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
      const user = userEvent.setup();
      render(<HomePage sampleReport={report} />);

      if (source === "sample") {
        await user.click(
          screen.getByRole("button", { name: /Generate sample Candidate Brief/i })
        );
      } else if (source === "github") {
        await user.type(
          screen.getByLabelText("Public GitHub repository URL"),
          "https://github.com/octocat/demo"
        );
        await user.click(
          screen.getByRole("button", { name: /Analyze public GitHub repository/i })
        );
      } else {
        await user.click(screen.getByRole("tab", { name: "Upload ZIP" }));
        await user.upload(
          screen.getByLabelText("Choose repository zip file"),
          new File(["PK"], "permitted-repository.zip", { type: "application/zip" })
        );
        await user.click(screen.getByRole("button", { name: /Analyze uploaded ZIP/i }));
      }

      await screen.findByRole("heading", { name: "Your Candidate Brief is ready" });
      await user.click(screen.getByRole("button", { name: "Copy 30s" }));

      await waitFor(() => expect(captureReportViewed).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(captureWalkthroughCopied).toHaveBeenCalledTimes(1));
      expect(captureReportViewed).toHaveBeenCalledWith("live");
      expect(captureWalkthroughCopied).toHaveBeenCalledWith("live", "30_second");
    },
    15_000
  );
});
