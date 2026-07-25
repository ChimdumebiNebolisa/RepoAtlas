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
  const indexedFiles = new Set(files.map(normalizeRelPath));
  const uniqueFiles = [...indexedFiles];
  const folderFileCounts = new Map<string, number>();
  for (const file of uniqueFiles) {
    const folder = toFolderPath(file);
    folderFileCounts.set(folder, (folderFileCounts.get(folder) ?? 0) + 1);
  }

  const fileRelationships = new Set<string>();
  for (const [fromFile, toFiles] of imports) {
    const normalizedFrom = normalizeRelPath(fromFile);
    if (!indexedFiles.has(normalizedFrom)) continue;
    for (const toFile of toFiles) {
      const normalizedTo = normalizeRelPath(toFile);
      if (!indexedFiles.has(normalizedTo)) continue;
      fileRelationships.add(JSON.stringify([normalizedFrom, normalizedTo]));
    }
  }

  const edgeWeights = new Map<string, { from: string; to: string; weight: number }>();
  for (const relationship of fileRelationships) {
    const [fromFile, toFile] = JSON.parse(relationship) as [string, string];
    const fromFolder = toFolderPath(fromFile);
    const toFolder = toFolderPath(toFile);
    const key = JSON.stringify([fromFolder, toFolder]);
    const existing = edgeWeights.get(key);
    edgeWeights.set(key, {
      from: fromFolder,
      to: toFolder,
      weight: (existing?.weight ?? 0) + 1,
    });
  }

  const folderDegree = new Map<string, number>();
  for (const { from, to, weight } of edgeWeights.values()) {
    folderDegree.set(from, (folderDegree.get(from) ?? 0) + weight);
    folderDegree.set(to, (folderDegree.get(to) ?? 0) + weight);
  }
  for (const folder of folderFileCounts.keys()) {
    if (!folderDegree.has(folder)) folderDegree.set(folder, 0);
  }

  const sortedFolders = Array.from(folderFileCounts.keys()).sort((a, b) => {
    const degreeDelta = folderDegree.get(b)! - folderDegree.get(a)!;
    if (degreeDelta !== 0) return degreeDelta;
    const fileCountDelta = folderFileCounts.get(b)! - folderFileCounts.get(a)!;
    if (fileCountDelta !== 0) return fileCountDelta;
    return a.localeCompare(b);
  });

  const selectedFolders = sortedFolders.slice(0, ARCH_NODE_CAP);
  if (sortedFolders.length > ARCH_NODE_CAP) {
    warnings.push(`Architecture nodes capped at ${ARCH_NODE_CAP} folders (from ${sortedFolders.length}).`);
  }
  if (uniqueFiles.length > selectedFolders.length) {
    warnings.push(
      `Architecture reduced from file-level (${uniqueFiles.length} files) to folder-level (${selectedFolders.length} folders).`
    );
  }

  const selectedFolderSet = new Set(selectedFolders);
  const weightedEdges = Array.from(edgeWeights.values()).filter(
    (edge) => selectedFolderSet.has(edge.from) && selectedFolderSet.has(edge.to)
  );
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
