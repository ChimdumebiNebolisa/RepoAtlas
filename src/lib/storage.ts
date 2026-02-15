/**
 * Report storage: JSON on disk.
 */

import fs from "fs";
import path from "path";
import type { Report } from "@/types/report";

const REPORTS_DIR = process.env.REPORTS_DIR ?? path.join(process.cwd(), "reports");

function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

export async function saveReport(reportId: string, report: Report): Promise<void> {
  ensureReportsDir();
  const filePath = path.join(REPORTS_DIR, `${reportId}.json`);
  await fs.promises.writeFile(filePath, JSON.stringify(report, null, 2), "utf-8");
}

export async function getReport(reportId: string): Promise<Report | null> {
  const filePath = path.join(REPORTS_DIR, `${reportId}.json`);
  try {
    const data = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(data) as Report;
  } catch {
    return null;
  }
}
