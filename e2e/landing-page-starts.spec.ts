import {
  expect,
  test,
  type Locator,
  type Page,
  type Request,
} from "@playwright/test";
import { expectCompletedReportInViewport, REPORT_TABS } from "./helpers";

const PUBLIC_REPOSITORY_URL =
  "https://github.com/ChimdumebiNebolisa/CellScope";
const PUBLIC_REPOSITORY_REF =
  "9276187bbb13c8dd98c81cadf0933cd0977b26bb";
const useExactMobileViewport =
  process.env.PLAYWRIGHT_EXACT_MOBILE_VIEWPORT === "1";

const candidatePages = [
  {
    label: "repository walkthrough guide",
    path: "/repository-walkthrough-interview",
    source: "interview_preparation",
    entranceLabel: "Start a repository walkthrough",
    sampleAction: "Run the bundled sample",
    directSample: true,
  },
  {
    label: "authored project guide",
    path: "/how-to-walk-through-a-project-in-an-interview",
    source: "interview_preparation",
    entranceLabel: "Start an authored-project brief",
    sampleAction: "Run the bundled sample",
    directSample: true,
  },
  {
    label: "structured preparation comparison",
    path: "/codebase-interview-preparation",
    source: "comparison_structured_preparation",
    entranceLabel: "Start an evidence-linked Candidate Brief",
    sampleAction: "Try the sample interview route",
    directSample: true,
  },
  {
    label: "AI summary comparison",
    path: "/ai-codebase-summary",
    source: "comparison_ai_summary",
    entranceLabel: "Start an evidence-linked Candidate Brief",
    sampleAction: "Try the evidence-linked sample",
    directSample: true,
  },
  {
    label: "code review interview guide",
    path: "/code-review-interview",
    source: "interview_preparation",
    entranceLabel: "Prepare a repository for a code review interview",
    sampleAction: "Run the bundled sample",
    directSample: false,
  },
] as const;

type InputMode = "sample" | "github";

function collectBrowserDiagnostics(page: Page): string[] {
  const diagnostics: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      diagnostics.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    const resourceType = response.request().resourceType();
    if (
      response.status() >= 400 &&
      ["document", "fetch", "xhr"].includes(resourceType)
    ) {
      diagnostics.push(
        `HTTP ${response.status()}: ${response.request().method()} ${response.url()}`,
      );
    }
  });
  return diagnostics;
}

async function focusWithKeyboard(
  page: Page,
  target: Locator,
  maximumTabs = 100,
): Promise<void> {
  await expect(target).toBeVisible();

  for (let index = 0; index < maximumTabs; index += 1) {
    if (
      await target.evaluate(
        (element) => element === element.ownerDocument.activeElement,
      )
    ) {
      await expect(target).toBeFocused();
      return;
    }
    await page.keyboard.press("Tab");
  }

  throw new Error(
    `Keyboard focus did not reach ${await target.evaluate(
      (element) => element.getAttribute("aria-label") ?? element.textContent,
    )}`,
  );
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

async function expectAllReportSectionsWithKeyboard(page: Page): Promise<void> {
  const report = page.getByTestId("generated-report");
  const candidateBriefTab = report.getByRole("tab", {
    name: REPORT_TABS[0],
  });
  await focusWithKeyboard(page, candidateBriefTab);

  for (const tabName of REPORT_TABS.slice(1)) {
    await page.keyboard.press("ArrowRight");
    const tab = report.getByRole("tab", { name: tabName });
    await expect(tab).toBeFocused();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(
      report.getByRole("tabpanel", { name: tabName }),
    ).toBeVisible();
  }

  await page.keyboard.press("Home");
  await expect(candidateBriefTab).toBeFocused();
  await expect(candidateBriefTab).toHaveAttribute("aria-selected", "true");
}

async function expectReadableEvidenceWithKeyboard(page: Page): Promise<void> {
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
  await focusWithKeyboard(page, evidenceLink, 250);
  await page.keyboard.press("Enter");
  await expect(evidenceCard).toBeInViewport();
  expect((await evidenceCard.innerText()).trim().length).toBeGreaterThan(20);
}

test.describe("candidate landing-page starts", () => {
  test.describe.configure({ mode: "serial", retries: 0 });

  for (const candidatePage of candidatePages) {
    for (const inputMode of ["sample", "github"] as const) {
      test(`${candidatePage.label} completes the ${inputMode} start by keyboard on its first attempt`, async ({
        page,
      }) => {
        if (useExactMobileViewport) {
          await page.setViewportSize({ width: 390, height: 844 });
        }

        const browserDiagnostics = collectBrowserDiagnostics(page);
        await page.goto(candidatePage.path);

        const entrance = page.getByRole("complementary", {
          name: candidatePage.entranceLabel,
        });
        const actionName =
          inputMode === "sample"
            ? candidatePage.sampleAction
            : "Use a public GitHub repository";
        const startAction = entrance.getByRole("link", { name: actionName });
        const directSampleRequest =
          inputMode === "sample" && candidatePage.directSample
            ? page.waitForRequest(
                (request) =>
                  request.method() === "POST" &&
                  new URL(request.url()).pathname === "/api/analyze",
              )
            : null;
        await focusWithKeyboard(page, startAction);
        await page.keyboard.press("Enter");

        await expect(page).toHaveURL(
          new RegExp(`\\?source=${candidatePage.source}#analyze$`),
        );
        await expect(
          page.getByRole("radio", { name: /Prepare for an interview/i }),
        ).toBeChecked();

        if (inputMode === "github") {
          const repositoryInput = page.getByLabel(
            "Public GitHub repository URL",
          );
          await focusWithKeyboard(page, repositoryInput);
          await page.keyboard.type(PUBLIC_REPOSITORY_URL);

          const refInput = page.getByLabel("Branch or tag (optional)");
          await focusWithKeyboard(page, refInput);
          await page.keyboard.type(PUBLIC_REPOSITORY_REF);
        }

        const analyzeRequest =
          directSampleRequest ??
          page.waitForRequest(
            (request) =>
              request.method() === "POST" &&
              new URL(request.url()).pathname === "/api/analyze",
          );
        if (!directSampleRequest) {
          const analyzeAction = page.getByRole("button", {
            name:
              inputMode === "sample"
                ? /Generate sample brief/i
                : /Analyze public GitHub repository/i,
          });
          await focusWithKeyboard(page, analyzeAction);
          await page.keyboard.press("Enter");
        }

        await expectAnalyzeRequest(await analyzeRequest, inputMode);
        await expectCompletedReportInViewport(page);
        await expect(
          page.getByRole("radio", { name: /Prepare for an interview/i }),
        ).toBeChecked();
        await expectAllReportSectionsWithKeyboard(page);
        await expectReadableEvidenceWithKeyboard(page);
        await expect(page).toHaveURL(
          new RegExp(`\\?source=${candidatePage.source}#analyze$`),
        );
        expect(browserDiagnostics).toEqual([]);
      });
    }
  }
});
