import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import AdmZip from "adm-zip";
import type { APIRequestContext } from "@playwright/test";
import type { Report } from "../src/types/report";

export const REPORTS_DIR = path.join(process.cwd(), ".playwright-reports");
export const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

export function zipFixture(fixtureName: string): Buffer {
  const zip = new AdmZip();
  zip.addLocalFolder(path.join(process.cwd(), "fixtures", fixtureName));
  return zip.toBuffer();
}

export function writeReport(reportId: string, report: Report): void {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(REPORTS_DIR, `${reportId}.json`),
    JSON.stringify(report, null, 2)
  );
}

export function minimalReport(overrides: Partial<Report> = {}): Report {
  return {
    repo_metadata: {
      name: "e2e-fixture",
      url: "zip",
      branch: "main",
      clone_hash: null,
      analyzed_at: new Date().toISOString(),
    },
    folder_map: { path: ".", type: "dir", children: [] },
    architecture: { nodes: [], edges: [] },
    start_here: [],
    danger_zones: [],
    run_commands: [],
    contribute_signals: { key_docs: [], ci_configs: [] },
    warnings: [],
    ...overrides,
  };
}

export function legacyReportWithoutBrief(): Report {
  return minimalReport({ repo_metadata: { name: "legacy-report", url: "zip", branch: "main", clone_hash: null, analyzed_at: new Date().toISOString() } });
}

export async function analyzeSample(request: APIRequestContext): Promise<string> {
  const res = await request.post("/api/analyze", {
    data: { sample: true },
  });
  if (!res.ok()) {
    throw new Error(`Sample analyze failed: ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { reportId?: string };
  if (!body.reportId) throw new Error("Sample analyze missing reportId");
  return body.reportId;
}

export async function analyzeZipRef(
  request: APIRequestContext,
  zipRef: string
): Promise<string> {
  const res = await request.post("/api/analyze", {
    data: { zipRef },
  });
  if (!res.ok()) {
    throw new Error(`zipRef analyze failed: ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { reportId?: string };
  if (!body.reportId) throw new Error("zipRef analyze missing reportId");
  return body.reportId;
}

export async function runSampleAnalyzeOnPage(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /Try sample Candidate Brief/i }).click();
  await page.getByRole("button", { name: /View report/i }).waitFor({
    state: "visible",
    timeout: 90_000,
  });
  await page.getByRole("button", { name: /View report/i }).click();
}

export function sharesDir(): string {
  return path.join(REPORTS_DIR, "shares");
}

export function expireShareToken(token: string): void {
  const recordPath = path.join(sharesDir(), `${token}.json`);
  const record = JSON.parse(fs.readFileSync(recordPath, "utf-8")) as { expiresAt: string };
  record.expiresAt = new Date(Date.now() - 60_000).toISOString();
  fs.writeFileSync(recordPath, JSON.stringify(record));
}

export const REPORT_TABS = [
  "Candidate Brief",
  "Overview",
  "Folder Map",
  "Architecture Map",
  "Start Here",
  "Danger Zones",
  "Run & Contribute",
  "Export",
] as const;
