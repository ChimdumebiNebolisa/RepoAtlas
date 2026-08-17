import { expect, test } from "@playwright/test";

test("interview-preparation page leads to the measurable analysis start", async ({ page }) => {
  await page.goto("/interview-preparation");

  await expect(page).toHaveTitle(/Code Interview Preparation with a Candidate Brief/);
  await expect(
    page.getByRole("heading", { name: "Prepare to explain your code, file by file." })
  ).toBeVisible();
  await expect(page.getByText("Walk me through this repository.")).toBeVisible();
  for (const output of [
    "Repository purpose",
    "Important folders and files",
    "Architecture and dependencies",
    "Evidence and next questions",
  ]) {
    await expect(page.getByRole("heading", { name: output })).toBeVisible();
  }
  await expect(page.getByText(/PDF and PNG exports/)).toBeVisible();
  await expect(page.getByText(/7-day encrypted browser sharing/)).toBeVisible();
  await expect(page.getByText(/Markdown and saved server links require saved report storage/)).toBeVisible();
  await expect(page.getByText(/Deeper TypeScript\/JavaScript, Python, and Java analysis/)).toBeVisible();
  await expect(page.getByText(/without executing code or calling AI/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Start with the route you can prove." }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Evidence-first repository walkthrough method" }),
  ).toContainText("Prepare file-backed talking points.");

  const publicExample = page.getByRole("link", {
    name: "Inspect the exact-commit FastAPI Candidate Brief",
  });
  await expect(publicExample).toHaveAttribute("href", "/examples/fastapi-candidate-brief");
  expect((await page.request.get("/examples/fastapi-candidate-brief")).status()).toBe(200);

  const primaryAction = page.getByRole("link", { name: "Prepare my Candidate Brief" });
  await expect(page.locator("a.btn-primary")).toHaveCount(1);
  await expect(primaryAction).toHaveAttribute(
    "href",
    "/?source=interview_preparation#analyze"
  );
  await primaryAction.click();

  await expect(page).toHaveURL(/\?source=interview_preparation#analyze$/);
  await expect(
    page.getByRole("heading", { name: "Analyze your repository." })
  ).toBeVisible();
});

const evidenceBackedBriefPromise =
  "Prepare to explain a repository with the ranked reading path, architecture context, source-backed commands, test inventory, and structural risk signals shown in the public FastAPI example. The example contains 12 starting files, 35 architecture nodes, 8 commands, 23 test files, and 127 risk signals. Its risk signals guide inspection; they do not prove runtime behavior, bugs, or vulnerabilities.";

for (const comparison of [
  {
    path: "/codebase-interview-preparation",
    source: "comparison_structured_preparation",
    action: "Try the sample interview route",
  },
  {
    path: "/ai-codebase-summary",
    source: "comparison_ai_summary",
    action: "Try the evidence-linked sample",
  },
] as const) {
  test(`${comparison.path} preserves the bounded interview start`, async ({ page }) => {
    await page.goto(comparison.path);

    await expect(page.getByText(evidenceBackedBriefPromise)).toBeVisible();
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
    const publicExample = page.getByRole("link", {
      name: "Inspect the public FastAPI repository example",
    });
    await expect(publicExample).toHaveAttribute(
      "href",
      "/examples/fastapi-candidate-brief",
    );
    const exampleResponse = await page.request.get(
      "/examples/fastapi-candidate-brief",
    );
    expect(exampleResponse.status()).toBe(200);
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
      page.getByRole("heading", { name: "Your repository brief is ready" }),
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
    page.getByRole("heading", { name: "Your repository brief is ready" })
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
    "Answer “Where would you start?” with a ranked reading path and file-backed talking points.",
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
    page.getByRole("heading", { name: "Your repository brief is ready" })
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

test("take-home coding interview guide is indexed and connects its public proof", async ({
  page,
  request,
}) => {
  const response = await request.get("/sitemap.xml");

  expect(response.ok()).toBe(true);
  await expect(response.text()).resolves.toContain("/take-home-coding-interview");

  await page.goto("/take-home-coding-interview");
  await expect(page).toHaveTitle("Take-home Coding Interview Review Guide | RepoAtlas");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Review a take-home coding assignment before the interview. Prepare the core path, decisions, tests, limits, and file-backed talking points.",
  );
  await expect(
    page.getByRole("heading", { name: "Review your take-home before you explain it." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Inspect the FastAPI Candidate Brief" }),
  ).toHaveAttribute("href", "/examples/fastapi-candidate-brief");
  await expect(page.locator(".guide-page .btn-primary")).toHaveCount(1);
});

test("homepage connects all three interview guides without replacing the sample action", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("button", { name: /Generate sample brief/ })
  ).toBeVisible();
  const guideNav = page.getByRole("navigation", {
    name: "Prepare to explain a repository.",
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
  await expect(
    guideNav.getByRole("link", { name: /Review a submitted take-home/ })
  ).toHaveAttribute("href", "/take-home-coding-interview");
});

test("every public proof cluster route connects proof, guidance, and a Candidate Brief start", async ({
  page,
  request,
}) => {
  const proofRoutes = [
    {
      path: "/",
      linkName: "Inspect the FastAPI Candidate Brief",
    },
    {
      path: "/interview-preparation",
      linkName: "Inspect the exact-commit FastAPI Candidate Brief",
    },
    {
      path: "/codebase-interview-preparation",
      linkName: "Inspect the public FastAPI repository example",
    },
    {
      path: "/ai-codebase-summary",
      linkName: "Inspect the public FastAPI repository example",
    },
    {
      path: "/repository-walkthrough-interview",
      linkName: "Compare the method with the exact-commit FastAPI Candidate Brief",
    },
    {
      path: "/how-to-walk-through-a-project-in-an-interview",
      linkName: "See the file-backed half in the public FastAPI Candidate Brief",
    },
    {
      path: "/take-home-coding-interview",
      linkName: "Inspect the FastAPI Candidate Brief",
    },
    {
      path: "/code-review-interview",
      linkName: "Inspect the public FastAPI Candidate Brief",
    },
  ] as const;

  for (const route of proofRoutes) {
    expect((await request.get(route.path)).status()).toBe(200);
    await page.goto(route.path);
    await expect(page.getByRole("link", { name: route.linkName })).toHaveAttribute(
      "href",
      "/examples/fastapi-candidate-brief",
    );
  }

  expect((await request.get("/examples/fastapi-candidate-brief")).status()).toBe(200);
  await page.goto("/examples/fastapi-candidate-brief");
  await expect(
    page.getByRole("link", { name: "Turn this report into an interview walkthrough" }),
  ).toHaveAttribute("href", "/repository-walkthrough-interview");
  await expect(
    page.getByRole("link", { name: "Run your public GitHub repository" }),
  ).toHaveAttribute("href", "/?source=fastapi_example#analyze");
});
