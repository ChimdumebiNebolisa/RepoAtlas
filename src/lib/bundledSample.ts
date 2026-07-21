import path from "path";
import { analyzeRepository, type AnalyzeInput, type AnalyzeOptions } from "@/analyzer";

export function bundledSampleInput(): AnalyzeInput {
  return {
    kind: "zip",
    zipRef: path.join(process.cwd(), "fixtures", "repo-ts"),
    zipName: "repo-ts",
  };
}

export function analyzeBundledSample(options: AnalyzeOptions = {}) {
  return analyzeRepository(bundledSampleInput(), {
    analysisIntent: "interview",
    persist: false,
    ...options,
  });
}
