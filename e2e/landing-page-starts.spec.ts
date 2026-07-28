import { expect, test, type Page, type Request } from "@playwright/test";
import { expectCompletedReportInViewport } from "./helpers";

const PUBLIC_REPOSITORY_URL =
  "https://github.com/ChimdumebiNebolisa/CellScope";
const PUBLIC_REPOSITORY_REF =
  "9276187bbb13c8dd98c81cadf0933cd0977b26bb";

const candidatePages = [
  {
    label: "repository walkthrough guide",
    path: "/repository-walkthrough-interview",
    source: "interview_preparation",
    entranceLabel: "Start a repository walkthrough",
    sampleAction: "Run the bundled sample",
  },
  {
    label: "authored project guide",
    path: "/how-to-walk-through-a-project-in-an-interview",
    source: "interview_preparation",
    entranceLabel: "Start an authored-project brief",
    sampleAction: "Run the bundled sample",
  },
  {
    label: "structured preparation comparison",
    path: "/codebase-interview-preparation",
    source: "comparison_structured_preparation",
    entranceLabel: "Start an evidence-linked Candidate Brief",
    sampleAction: "Try the sample interview route",
  },
  {
    label: "AI summary comparison",
    path: "/ai-codebase-summary",
    source: "comparison_ai_summary",
    entranceLabel: "Start an evidence-linked Candidate Brief",
    sampleAction: "Try the evidence-linked sample",
  },
] as const;

type InputMode = "sample" | "github";

function collectBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function expectAnalyzeRequest(
  request: Request,
  inputMode: InputMode,
): Promise<void> {
  const payload = request.postDataJSON() as Record<string, unknown>;
  expect(payload.analysisIntent).toBe("interview");

  if (inputMode === "sample") {
    expect(payload.sample).toBe(true);
    return;
  }

  expect(payload.githubUrl).toBe(PUBLIC_REPOSITORY_URL);
  expect(payload.ref).toBe(PUBLIC_REPOSITORY_REF);
}

async function expectReadableEvidence(page: Page): Promise<void> {
  const report = page.getByTestId("generated-report");

  const walkthrough = report.getByTestId("walkthrough-30-second");
  await expect(walkthrough).toBeVisible();
  const walkthroughText = (await walkthrough.locator("p").last().innerText()).trim();
  expect(walkthroughText.length).toBeGreaterThan(80);

  const evidenceCard = report.locator('[id^="evidence-"]').first();
  await expect(evidenceCard).toBeVisible();
  const cardId = (await evidenceCard.getAttribute("id"))?.replace(/^evidence-/, "");
  expect(cardId).toBeTruthy();

  const evidenceLink = report
    .getByRole("button", { name: cardId!, exact: true })
    .first();
  await expect(evidenceLink).toBeVisible();
  await evidenceLink.click();
  await expect(evidenceCard).toBeInViewport();
  expect((await evidenceCard.innerText()).trim().length).toBeGreaterThan(20);
}

test.describe("candidate landing-page starts", () => {
  test.describe.configure({ mode: "serial", retries: 0 });

  for (const candidatePage of candidatePages) {
    for (const inputMode of ["sample", "github"] as const) {
      test(`${candidatePage.label} completes the ${inputMode} start on its first attempt`, async ({
        page,
      }) => {
        const browserErrors = collectBrowserErrors(page);
        await page.goto(candidatePage.path);

        const entrance = page.getByRole("complementary", {
          name: candidatePage.entranceLabel,
        });
        const actionName =
          inputMode === "sample"
            ? candidatePage.sampleAction
            : "Use a public GitHub repository";
        await entrance.getByRole("link", { name: actionName }).click();

        await expect(page).toHaveURL(
          new RegExp(`\\?source=${candidatePage.source}#analyze$`),
        );
        await expect(
          page.getByRole("radio", { name: /Interview walkthrough/i }),
        ).toBeChecked();

        if (inputMode === "github") {
          await page
            .getByLabel("Public GitHub repository URL")
            .fill(PUBLIC_REPOSITORY_URL);
          await page
            .getByLabel("Branch or tag (optional)")
            .fill(PUBLIC_REPOSITORY_REF);
        }

        const analyzeRequest = page.waitForRequest(
          (request) =>
            request.method() === "POST" &&
            new URL(request.url()).pathname === "/api/analyze",
        );
        await page
          .getByRole("button", {
            name:
              inputMode === "sample"
                ? /Generate sample Candidate Brief/i
                : /Analyze public GitHub repository/i,
          })
          .click();

        await expectAnalyzeRequest(await analyzeRequest, inputMode);
        await expectCompletedReportInViewport(page);
        await expect(
          page.getByRole("radio", { name: /Interview walkthrough/i }),
        ).toBeChecked();
        await expectReadableEvidence(page);
        await expect(page).toHaveURL(
          new RegExp(`\\?source=${candidatePage.source}#analyze$`),
        );
        expect(browserErrors).toEqual([]);
      });
    }
  }
});
