import type { Architecture } from "@/types/report";
import path from "path";
import { normalizeRelPath } from "./shared";

const ARCH_NODE_CAP = 50;
const ARCH_EDGE_CAP = 200;

function toFolderPath(filePath: string): string {
  const normalized = normalizeRelPath(filePath);
  const directory = path.posix.dirname(normalized);
  return directory === "." ? "." : directory;
}

export function buildReducedArchitecture(
  files: string[],
  imports: Map<string, Set<string>>
): { architecture: Architecture; warnings: string[] } {
  const warnings: string[] = [];
  const folderFileCounts = new Map<string, number>();
  for (const file of files) {
    const folder = toFolderPath(file);
    folderFileCounts.set(folder, (folderFileCounts.get(folder) ?? 0) + 1);
  }

  const edgeWeights = new Map<string, number>();
  for (const [fromFile, toFiles] of imports) {
    const fromFolder = toFolderPath(fromFile);
    for (const toFile of toFiles) {
      const toFolder = toFolderPath(toFile);
      const key = `${fromFolder}=>${toFolder}`;
      edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
    }
  }

  const folderDegree = new Map<string, number>();
  for (const [edgeKey, weight] of edgeWeights) {
    const [from, to] = edgeKey.split("=>");
    folderDegree.set(from, (folderDegree.get(from) ?? 0) + weight);
    folderDegree.set(to, (folderDegree.get(to) ?? 0) + weight);
  }
  for (const folder of folderFileCounts.keys()) {
    if (!folderDegree.has(folder)) folderDegree.set(folder, 0);
  }

  const sortedFolders = Array.from(folderFileCounts.keys()).sort((a, b) => {
    const degreeDelta = (folderDegree.get(b) ?? 0) - (folderDegree.get(a) ?? 0);
    if (degreeDelta !== 0) return degreeDelta;
    const fileCountDelta = (folderFileCounts.get(b) ?? 0) - (folderFileCounts.get(a) ?? 0);
    if (fileCountDelta !== 0) return fileCountDelta;
    return a.localeCompare(b);
  });

  const selectedFolders = sortedFolders.slice(0, ARCH_NODE_CAP);
  if (sortedFolders.length > ARCH_NODE_CAP) {
    warnings.push(`Architecture nodes capped at ${ARCH_NODE_CAP} folders (from ${sortedFolders.length}).`);
  }
  if (files.length > selectedFolders.length) {
    warnings.push(
      `Architecture reduced from file-level (${files.length} files) to folder-level (${selectedFolders.length} folders).`
    );
  }

  const selectedFolderSet = new Set(selectedFolders);
  const weightedEdges = Array.from(edgeWeights.entries())
    .map(([edgeKey, weight]) => {
      const [from, to] = edgeKey.split("=>");
      return { from, to, weight };
    })
    .filter((edge) => selectedFolderSet.has(edge.from) && selectedFolderSet.has(edge.to));
  const edges = weightedEdges
    .sort((a, b) => {
      const weightDelta = b.weight - a.weight;
      if (weightDelta !== 0) return weightDelta;
      const fromDelta = a.from.localeCompare(b.from);
      if (fromDelta !== 0) return fromDelta;
      return a.to.localeCompare(b.to);
    })
    .slice(0, ARCH_EDGE_CAP)
    .map(({ from, to }) => ({ from, to, type: "import" as const }));

  if (weightedEdges.length > ARCH_EDGE_CAP) {
    warnings.push(`Architecture edges capped at ${ARCH_EDGE_CAP} links (from ${weightedEdges.length}).`);
  }

  const nodes = selectedFolders.map((folder) => ({
    id: folder,
    label: folder,
    type: "folder" as const,
  }));
  return { architecture: { nodes, edges }, warnings };
}
