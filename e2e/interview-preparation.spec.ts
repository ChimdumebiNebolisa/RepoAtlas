import { expect, test } from "@playwright/test";

test("interview-preparation page leads to the measurable analysis start", async ({ page }) => {
  await page.goto("/interview-preparation");

  await expect(page).toHaveTitle(/Code Interview Preparation with a Candidate Brief/);
  await expect(
    page.getByRole("heading", { name: "Prepare to explain your code, file by file." })
  ).toBeVisible();
  await expect(page.getByText("Walk me through this repository.")).toBeVisible();
  for (const output of ["Entry points", "Architecture", "Risk signals", "Reading order"]) {
    await expect(page.getByRole("heading", { name: output })).toBeVisible();
  }
  await expect(page.getByText(/PDF and PNG exports/)).toBeVisible();
  await expect(page.getByText(/7-day encrypted browser sharing/)).toBeVisible();
  await expect(page.getByText(/Markdown and saved server links require saved report storage/)).toBeVisible();
  await expect(page.getByText(/Deeper TypeScript\/JavaScript, Python, and Java analysis/)).toBeVisible();
  await expect(page.getByText(/without executing code or calling AI/)).toBeVisible();

  const primaryAction = page.getByRole("link", { name: "Prepare my Candidate Brief" });
  await expect(primaryAction).toHaveAttribute(
    "href",
    "/?source=interview_preparation#analyze"
  );
  await primaryAction.click();

  await expect(page).toHaveURL(/\?source=interview_preparation#analyze$/);
  await expect(
    page.getByRole("heading", { name: "Start with the sample or your repository." })
  ).toBeVisible();
});

for (const comparison of [
  {
    path: "/codebase-interview-preparation",
    source: "comparison_structured_preparation",
    action: "Try the sample interview route",
    whatYouGet: "Get a reading route, timed walkthroughs, risk signals, and evidence you can inspect.",
  },
  {
    path: "/ai-codebase-summary",
    source: "comparison_ai_summary",
    action: "Try the evidence-linked sample",
    whatYouGet: "Get a reading route, timed walkthroughs, risk signals, and evidence you can inspect.",
  },
] as const) {
  test(`${comparison.path} preserves the bounded interview start`, async ({ page }) => {
    await page.goto(comparison.path);

    await expect(page.getByText(comparison.whatYouGet)).toBeVisible();
    await expect(page.getByTestId("comparison-sample-proof")).toContainText(
      "Real file-backed sample",
    );

    const primaryAction = page.getByRole("link", { name: comparison.action });
    await expect(primaryAction).toHaveCount(1);
    await expect(primaryAction).toHaveAttribute(
      "href",
      `/?source=${comparison.source}&sample=1#analyze`,
    );
    await expect(
      page.getByRole("link", { name: "Use a public GitHub repository" }),
    ).toHaveAttribute("href", `/?source=${comparison.source}#analyze`);
    const analyzeRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/analyze",
    );
    await primaryAction.click();

    await expect(page).toHaveURL(
      new RegExp(`\\?source=${comparison.source}#analyze$`),
    );
    expect((await analyzeRequest).postDataJSON()).toMatchObject({
      sample: true,
      analysisIntent: "interview",
    });
    await expect(
      page.getByRole("heading", { name: "Your Candidate Brief is ready" }),
    ).toBeVisible();
  });

  test(`${comparison.path} keeps its complete entrance inside 390 pixels`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(comparison.path);

    const proof = page.getByTestId("comparison-sample-proof");
    const sampleAction = page.getByRole("link", { name: comparison.action });
    const githubAction = page.getByRole("link", {
      name: "Use a public GitHub repository",
    });

    await expect(proof).toBeVisible();
    await expect(sampleAction).toBeVisible();
    await expect(githubAction).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    for (const element of [proof, sampleAction, githubAction]) {
      const box = await element.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
      expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    }
  });
}

test("repository walkthrough guide teaches the method and opens the bundled sample path", async ({ page }) => {
  await page.goto("/repository-walkthrough-interview");

  await expect(page).toHaveTitle(/Repository Walkthrough Interview Guide/);
  await expect(
    page.getByRole("heading", { name: "How to walk an interviewer through a repository." })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Use a reading order you can explain." })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Trace responsibility, not every dependency." })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Label what you know." })).toBeVisible();
  await expect(page.getByText("Observed", { exact: true })).toBeVisible();
  await expect(page.getByText("Inferred", { exact: true })).toBeVisible();
  await expect(page.getByText("Unknown", { exact: true })).toBeVisible();
  await expect(page.getByText(/does not execute code or call AI/)).toBeVisible();
  await expect(page.getByText(/TypeScript\/JavaScript, Python, and Java/)).toBeVisible();

  const startPanel = page.getByRole("complementary", {
    name: "Start a repository walkthrough",
  });
  const primaryAction = startPanel.getByRole("link", { name: "Run the bundled sample" });
  const githubAction = startPanel.getByRole("link", {
    name: "Use a public GitHub repository",
  });
  await expect(primaryAction).toHaveCount(1);
  await expect(primaryAction).toHaveAttribute(
    "href",
    "/?source=interview_preparation&sample=1#analyze"
  );
  await expect(githubAction).toHaveAttribute(
    "href",
    "/?source=interview_preparation#analyze"
  );
  await expect(page.locator(".guide-page .btn-primary")).toHaveCount(1);
  const analyzeRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/analyze",
  );
  await primaryAction.click();

  await expect(page).toHaveURL(/\?source=interview_preparation#analyze$/);
  expect((await analyzeRequest).postDataJSON()).toMatchObject({
    sample: true,
    analysisIntent: "interview",
  });
  await expect(
    page.getByRole("heading", { name: "Your Candidate Brief is ready" })
  ).toBeVisible();
});

for (const viewport of [
  { label: "desktop", width: 1440, height: 757 },
  { label: "390-pixel mobile", width: 390, height: 844 },
] as const) {
  test(`repository walkthrough guide keeps both starts in its ${viewport.label} first viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/repository-walkthrough-interview");

    const startPanel = page.getByRole("complementary", {
      name: "Start a repository walkthrough",
    });
    const sampleAction = startPanel.getByRole("link", {
      name: "Run the bundled sample",
    });
    const githubAction = startPanel.getByRole("link", {
      name: "Use a public GitHub repository",
    });

    await expect(startPanel).toBeVisible();
    await expect(sampleAction).toBeVisible();
    await expect(githubAction).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    for (const element of [startPanel, sampleAction, githubAction]) {
      const box = await element.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
  });
}

test("repository walkthrough guide is included in the sitemap", async ({ request }) => {
  const response = await request.get("/sitemap.xml");

  expect(response.ok()).toBe(true);
  await expect(response.text()).resolves.toContain("/repository-walkthrough-interview");
});

test("repository walkthrough guide has its exact search-result promise", async ({
  page,
}) => {
  await page.goto("/repository-walkthrough-interview");

  await expect(page).toHaveTitle(
    "Repository Walkthrough Interview Guide | RepoAtlas"
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Learn how to explain an unfamiliar repository with a defensible reading order, architecture map, risk signals, and file-backed talking points."
  );
});

test("authored project guide separates candidate intent from repository evidence", async ({ page }) => {
  await page.goto("/how-to-walk-through-a-project-in-an-interview");

  await expect(page).toHaveTitle(/How to Walk Through a Project in an Interview/);
  await expect(
    page.getByRole("heading", { name: "How to walk through a project in an interview" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pick a project with decisions you can defend." })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Separate your intent from file evidence." })
  ).toBeVisible();
  await expect(page.getByText("Only you can supply")).toBeVisible();
  await expect(page.getByText("The repository can support")).toBeVisible();
  await expect(page.getByText(/cannot know why you made a decision/)).toBeVisible();
  await expect(page.getByText(/does not execute code or call AI/)).toBeVisible();
  await expect(page.getByText(/TypeScript\/JavaScript, Python, and Java/)).toBeVisible();

  const startPanel = page.getByRole("complementary", {
    name: "Start an authored-project brief",
  });
  await expect(startPanel).toContainText(
    "RepoAtlas supplies entry points, architecture, tests, and evidence.",
  );
  await expect(startPanel).toContainText(
    "You supply the rationale, constraints, and outcomes.",
  );
  const primaryAction = startPanel.getByRole("link", {
    name: "Run the bundled sample",
  });
  const githubAction = startPanel.getByRole("link", {
    name: "Use a public GitHub repository",
  });
  await expect(primaryAction).toHaveCount(1);
  await expect(primaryAction).toHaveAttribute(
    "href",
    "/?source=interview_preparation&sample=1#analyze"
  );
  await expect(githubAction).toHaveAttribute(
    "href",
    "/?source=interview_preparation#analyze"
  );
  await expect(page.locator(".guide-page .btn-primary")).toHaveCount(1);
  await expect(
    page
      .getByRole("region", { name: "See what repository evidence looks like." })
      .getByRole("link", { name: "Run the bundled sample" }),
  ).toHaveAttribute(
    "href",
    "/?source=interview_preparation&sample=1#analyze",
  );
  const analyzeRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/analyze",
  );
  await primaryAction.click();

  await expect(page).toHaveURL(/\?source=interview_preparation#analyze$/);
  expect((await analyzeRequest).postDataJSON()).toMatchObject({
    sample: true,
    analysisIntent: "interview",
  });
  await expect(
    page.getByRole("heading", { name: "Your Candidate Brief is ready" })
  ).toBeVisible();
});

for (const viewport of [
  { label: "desktop", width: 1440, height: 900 },
  { label: "390-pixel mobile", width: 390, height: 844 },
] as const) {
  test(`authored project guide keeps both starts in its ${viewport.label} first viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/how-to-walk-through-a-project-in-an-interview");

    const startPanel = page.getByRole("complementary", {
      name: "Start an authored-project brief",
    });
    const sampleAction = startPanel.getByRole("link", {
      name: "Run the bundled sample",
    });
    const githubAction = startPanel.getByRole("link", {
      name: "Use a public GitHub repository",
    });

    await expect(startPanel).toBeVisible();
    await expect(sampleAction).toBeVisible();
    await expect(githubAction).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    for (const element of [startPanel, sampleAction, githubAction]) {
      const box = await element.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
  });
}

test("authored project guide is included in the sitemap", async ({ request }) => {
  const response = await request.get("/sitemap.xml");

  expect(response.ok()).toBe(true);
  await expect(response.text()).resolves.toContain(
    "/how-to-walk-through-a-project-in-an-interview"
  );
});

test("authored project guide has its exact search-result promise", async ({
  page,
}) => {
  await page.goto("/how-to-walk-through-a-project-in-an-interview");

  await expect(page).toHaveTitle(
    "How to Walk Through a Project in an Interview | RepoAtlas"
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Use a practical project interview structure for your contribution, architecture, technical decisions, tradeoffs, results, and next improvement."
  );
});

test("homepage connects both interview guides without replacing the sample action", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("button", { name: /Try bundled sample/ })
  ).toBeVisible();
  const guideNav = page.getByRole("navigation", {
    name: "Prepare for the walkthrough question.",
  });
  await expect(
    guideNav.getByRole("link", { name: /Explain an unfamiliar repository/ })
  ).toHaveAttribute("href", "/repository-walkthrough-interview");
  await expect(
    guideNav.getByRole("link", { name: /Explain a project you built/ })
  ).toHaveAttribute(
    "href",
    "/how-to-walk-through-a-project-in-an-interview"
  );
});
