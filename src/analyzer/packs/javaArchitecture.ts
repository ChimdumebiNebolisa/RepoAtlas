import path from "path";
import type { Architecture } from "@/types/report";
import { normalizeJavaPath } from "./javaShared";

const ARCH_NODE_CAP = 50;
const ARCH_EDGE_CAP = 200;

function toPackagePath(filePath: string): string {
  const normalized = normalizeJavaPath(filePath);
  const match = normalized.match(/src\/(?:main|test)\/java\/(.+)\/[^/]+\.java$/);
  if (match) return match[1].replace(/\//g, ".");
  const directory = path.posix.dirname(normalized);
  return directory === "." ? "." : directory.replace(/\//g, ".");
}

export function buildJavaArchitecture(
  files: string[],
  imports: Map<string, Set<string>>
): { architecture: Architecture; warnings: string[] } {
  const warnings: string[] = [];
  const packageFileCounts = new Map<string, number>();
  for (const file of files) {
    const packagePath = toPackagePath(file);
    packageFileCounts.set(packagePath, (packageFileCounts.get(packagePath) ?? 0) + 1);
  }

  const edgeWeights = new Map<string, number>();
  for (const [fromFile, toFiles] of imports) {
    const fromPackage = toPackagePath(fromFile);
    for (const toFile of toFiles) {
      const key = `${fromPackage}=>${toPackagePath(toFile)}`;
      edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
    }
  }

  const packageDegree = new Map<string, number>();
  for (const [edgeKey, weight] of edgeWeights) {
    const [from, to] = edgeKey.split("=>");
    packageDegree.set(from, (packageDegree.get(from) ?? 0) + weight);
    packageDegree.set(to, (packageDegree.get(to) ?? 0) + weight);
  }
  for (const packagePath of packageFileCounts.keys()) {
    if (!packageDegree.has(packagePath)) packageDegree.set(packagePath, 0);
  }

  const sortedPackages = [...packageFileCounts.keys()].sort((left, right) => {
    const degreeDelta = (packageDegree.get(right) ?? 0) - (packageDegree.get(left) ?? 0);
    if (degreeDelta !== 0) return degreeDelta;
    const countDelta =
      (packageFileCounts.get(right) ?? 0) - (packageFileCounts.get(left) ?? 0);
    return countDelta !== 0 ? countDelta : left.localeCompare(right);
  });
  const selectedPackages = sortedPackages.slice(0, ARCH_NODE_CAP);
  if (sortedPackages.length > ARCH_NODE_CAP) {
    warnings.push(
      `Architecture nodes capped at ${ARCH_NODE_CAP} packages (from ${sortedPackages.length}).`
    );
  }
  if (files.length > selectedPackages.length) {
    warnings.push(
      `Architecture reduced from file-level (${files.length} files) to package-level (${selectedPackages.length} packages).`
    );
  }

  const selected = new Set(selectedPackages);
  const eligibleEdges = [...edgeWeights.entries()]
    .map(([key, weight]) => {
      const [from, to] = key.split("=>");
      return { from, to, weight };
    })
    .filter(({ from, to }) => selected.has(from) && selected.has(to))
    .sort((left, right) =>
      right.weight - left.weight ||
      left.from.localeCompare(right.from) ||
      left.to.localeCompare(right.to)
    );
  if (eligibleEdges.length > ARCH_EDGE_CAP) {
    warnings.push(
      `Architecture edges capped at ${ARCH_EDGE_CAP} links (from ${eligibleEdges.length}).`
    );
  }

  return {
    architecture: {
      nodes: selectedPackages.map((packagePath) => ({
        id: packagePath,
        label: packagePath,
        type: "folder",
      })),
      edges: eligibleEdges.slice(0, ARCH_EDGE_CAP).map(({ from, to }) => ({
        from,
        to,
        type: "import",
      })),
    },
    warnings,
  };
}
