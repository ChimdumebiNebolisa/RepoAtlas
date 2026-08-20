import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { gunzipSync } from "node:zlib";

const CONTROLLED_CHECK_STORAGE_KEY = "repoatlas-controlled-check";
const TRACKED_USAGE_EVENTS = [
  "analysis_started",
  "analysis_completed",
  "report_viewed",
  "walkthrough_copied",
] as const;
const browserUserAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

type CapturedEvent = {
  event: string;
  properties: Record<string, unknown>;
};

function decodeCapturedEvents(body: Buffer | null): CapturedEvent[] {
  if (!body) return [];

  try {
    const decoded =
      body[0] === 0x1f && body[1] === 0x8b ? gunzipSync(body) : body;
    const payload = JSON.parse(decoded.toString("utf8")) as
      | CapturedEvent[]
      | { batch?: CapturedEvent[] };
    if (Array.isArray(payload)) return payload;
    return Array.isArray(payload.batch) ? payload.batch : [];
  } catch {
    return [];
  }
}

async function createAnalyticsContext(
  browser: Browser,
  baseURL: string,
  controlled: boolean
) {
  const context = await browser.newContext({
    baseURL,
    userAgent: browserUserAgent,
    storageState: {
      cookies: [],
      origins: controlled
        ? [
            {
              origin: new URL(baseURL).origin,
              localStorage: [
                { name: CONTROLLED_CHECK_STORAGE_KEY, value: "true" },
              ],
            },
          ]
        : [],
    },
  });

  // PostHog intentionally drops Playwright's normal browser identity as bot
  // traffic. This transport-only regression uses a regular Chrome identity so
  // it can inspect the exact request that an accepted browser would send.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "userAgentData", {
      get: () => ({ brands: [{ brand: "Google Chrome", version: "140" }] }),
    });
  });

  return context;
}

async function captureUsageJourney(
  context: BrowserContext
): Promise<CapturedEvent[]> {
  const capturedEvents: CapturedEvent[] = [];
  await context.route("https://us.i.posthog.com/**", async (route) => {
    capturedEvents.push(
      ...decodeCapturedEvents(route.request().postDataBuffer())
    );
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  const page: Page = await context.newPage();
  await page.goto("/");
  await page
    .getByRole("button", { name: /Generate the bundled sample brief/i })
    .click();
  await expect(page.getByTestId("completed-report-heading")).toBeVisible();
  await page.getByRole("button", { name: "Copy 30s" }).click();

  await expect
    .poll(
      () => [...new Set(capturedEvents.map((captured) => captured.event))],
      { timeout: 15_000 }
    )
    .toEqual(expect.arrayContaining([...TRACKED_USAGE_EVENTS]));

  return capturedEvents.filter((captured) =>
    TRACKED_USAGE_EVENTS.includes(
      captured.event as (typeof TRACKED_USAGE_EVENTS)[number]
    )
  );
}

test.describe("controlled release-check analytics", () => {
  test("marks automated usage while ordinary candidate usage stays unmarked", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium");
    const baseURL = String(testInfo.project.use.baseURL);
    const controlledContext = await createAnalyticsContext(
      browser,
      baseURL,
      true
    );
    const ordinaryContext = await createAnalyticsContext(
      browser,
      baseURL,
      false
    );

    try {
      const controlledEvents = await captureUsageJourney(controlledContext);
      const ordinaryEvents = await captureUsageJourney(ordinaryContext);

      for (const event of TRACKED_USAGE_EVENTS) {
        expect(
          controlledEvents.find((captured) => captured.event === event)
            ?.properties.is_controlled_check
        ).toBe(true);
        expect(
          ordinaryEvents.find((captured) => captured.event === event)
            ?.properties
        ).not.toHaveProperty("is_controlled_check");
      }
    } finally {
      await controlledContext.close();
      await ordinaryContext.close();
    }
  });
});
