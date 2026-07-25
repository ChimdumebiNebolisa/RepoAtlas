/**
 * Deterministic documentation discovery and canonicalization.
 *
 * Goals (Phase 3):
 *  - Discover documentation files and sort them deterministically.
 *  - Prefer meaningful root documentation over nested package docs.
 *  - Detect exact and normalized duplicates via content hashes.
 *  - Keep every document available; only *group* duplicates and *flag* (never
 *    silently discard) similar-but-different documents.
 *  - Select one canonical document per duplicate group for downstream use
 *    (purpose extraction, run commands, evidence, repeated-doc signals).
 */

import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import type {
  DocumentInventory,
  DocumentInventoryItem,
  DuplicateDocGroup,
  SimilarDocGroup,
} from "@/types/report";

type DocCategory = DocumentInventoryItem["category"];
type DocScope = DocumentInventoryItem["scope"];

// Lower number = higher priority when choosing a canonical document and when
// sorting. Root docs beat docs/, which beat nested package docs.
const CATEGORY_RANK: Record<DocCategory, number> = {
  readme: 0,
  contributing: 1,
  architecture: 2,
  docs: 3,
  changelog: 4,
  license: 5,
  other: 6,
};

const SCOPE_RANK: Record<DocScope, number> = {
  root: 0,
  docs: 1,
  nested: 2,
};

const DOC_EXTENSIONS = new Set([".md", ".mdx", ".rst", ".txt", ".adoc"]);
const SIMILARITY_THRESHOLD = 0.85;

function classify(relPath: string): { category: DocCategory; scope: DocScope } | null {
  const normalized = relPath.replace(/\\/g, "/");
  const name = normalized.split("/").pop() as string;
  const upper = name.toUpperCase();
  const ext = path.extname(name).toLowerCase();
  const isRoot = !normalized.includes("/");
  const inDocsDir = /^docs\//i.test(normalized);
  const scope: DocScope = isRoot ? "root" : inDocsDir ? "docs" : "nested";
  const hasSupportedExtension = ext === "" || DOC_EXTENSIONS.has(ext);

  if (/^README(\.[^.]+)?$/i.test(name) && hasSupportedExtension) {
    return { category: "readme", scope };
  }
  if (/^CONTRIBUTING(\.[^.]+)?$/i.test(name) && hasSupportedExtension) {
    return { category: "contributing", scope };
  }
  if (/^CHANGELOG(\.[^.]+)?$/i.test(name) && hasSupportedExtension) {
    return { category: "changelog", scope };
  }
  if (/^(LICENSE|LICENCE|COPYING)(\.[^.]+)?$/i.test(name) && hasSupportedExtension) {
    return { category: "license", scope };
  }
  if (/^(ARCHITECTURE|DESIGN|ADR)/i.test(upper) && DOC_EXTENSIONS.has(ext)) {
    return { category: "architecture", scope };
  }
  // Any documentation-extension file inside a docs/ directory.
  if (inDocsDir && DOC_EXTENSIONS.has(ext)) return { category: "docs", scope };
  return null;
}

function isInsideWorkspace(workspaceRoot: string, candidatePath: string): boolean {
  const relative = path.relative(workspaceRoot, candidatePath);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function safeDocumentPath(
  workspacePath: string,
  candidatePath: string
): { fullPath: string; relativePath: string } | null {
  const normalized = candidatePath.replace(/\\/g, "/");
  if (
    path.posix.isAbsolute(normalized) ||
    /^[a-zA-Z]:\//.test(normalized) ||
    path.posix.normalize(normalized) !== normalized
  ) {
    return null;
  }

  try {
    const workspaceRoot = fs.realpathSync(workspacePath);
    const fullPath = path.resolve(workspaceRoot, normalized);
    if (!isInsideWorkspace(workspaceRoot, fullPath)) return null;

    const relative = path.relative(workspaceRoot, fullPath);
    let current = workspaceRoot;
    const segments = relative.split(path.sep);
    for (const [index, segment] of segments.entries()) {
      current = path.join(current, segment);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) return null;
      const isFile = index === segments.length - 1;
      if (isFile ? !stat.isFile() : !stat.isDirectory()) return null;
    }

    return { fullPath, relativePath: normalized };
  } catch {
    return null;
  }
}

/** Normalize text for duplicate detection (BOM, CRLF/LF, trailing + surrounding whitespace). */
export function normalizeDocContent(raw: string): string {
  let text = raw;
  // Strip UTF-8 BOM.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  // CRLF / CR -> LF.
  text = text.replace(/\r\n?/g, "\n");
  // Trailing whitespace per line.
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");
  // Safe surrounding whitespace: collapse leading/trailing blank lines.
  text = text.replace(/^\n+/, "").replace(/\n+$/, "");
  return text;
}

function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

function comparePriority(a: DocumentInventoryItem, b: DocumentInventoryItem): number {
  const ra = CATEGORY_RANK[a.category] * 10 + SCOPE_RANK[a.scope];
  const rb = CATEGORY_RANK[b.category] * 10 + SCOPE_RANK[b.scope];
  if (ra !== rb) return ra - rb;
  // Shallower paths first, then lexicographic — fully deterministic.
  const da = a.path.split("/").length;
  const db = b.path.split("/").length;
  if (da !== db) return da - db;
  return a.path.localeCompare(b.path);
}

function normalizedLineSet(text: string): Set<string> {
  return new Set(
    normalizeDocContent(text)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/**
 * Discover and canonicalize documentation.
 *
 * @param workspacePath absolute repo root
 * @param candidatePaths repo-relative file paths to consider (typically all
 *   indexed files); non-documentation files are ignored.
 */
export function discoverDocuments(
  workspacePath: string,
  candidatePaths: string[]
): DocumentInventory {
  const items: DocumentInventoryItem[] = [];
  const rawByPath = new Map<string, string>();
  const seenPaths = new Set<string>();

  for (const rel of candidatePaths) {
    const classified = classify(rel);
    if (!classified) continue;
    const safePath = safeDocumentPath(workspacePath, rel);
    if (!safePath || seenPaths.has(safePath.relativePath)) continue;
    let raw: string;
    try {
      raw = fs.readFileSync(safePath.fullPath, "utf-8");
    } catch {
      continue;
    }
    const normalizedContent = normalizeDocContent(raw);
    if (!normalizedContent) continue;
    seenPaths.add(safePath.relativePath);
    rawByPath.set(safePath.relativePath, raw);
    items.push({
      path: safePath.relativePath,
      category: classified.category,
      scope: classified.scope,
      bytes: Buffer.byteLength(raw, "utf-8"),
      content_hash: sha256(raw),
      normalized_hash: sha256(normalizedContent),
      canonical: false,
    });
  }

  // Deterministic ordering before any grouping (requirement 2).
  items.sort(comparePriority);

  // Group by normalized hash. The highest-priority member is canonical.
  const groupsByHash = new Map<string, DocumentInventoryItem[]>();
  for (const item of items) {
    const list = groupsByHash.get(item.normalized_hash) ?? [];
    list.push(item);
    groupsByHash.set(item.normalized_hash, list);
  }

  const duplicateGroups: DuplicateDocGroup[] = [];
  for (const [, members] of groupsByHash) {
    // members are already priority-sorted (items was sorted).
    const [canonical, ...rest] = members;
    canonical.canonical = true;
    if (rest.length === 0) continue;
    const duplicates: string[] = [];
    let anyByteIdentical = false;
    let allByteIdentical = true;
    for (const dup of rest) {
      dup.canonical = false;
      dup.duplicate_of = canonical.path;
      duplicates.push(dup.path);
      if (dup.content_hash === canonical.content_hash) anyByteIdentical = true;
      else allByteIdentical = false;
    }
    duplicateGroups.push({
      canonical: canonical.path,
      duplicates: duplicates.sort((a, b) => a.localeCompare(b)),
      reason:
        allByteIdentical && anyByteIdentical ? "identical" : "normalized-identical",
    });
  }

  duplicateGroups.sort((a, b) => a.canonical.localeCompare(b.canonical));

  // Flag similar-but-different canonical docs (never suppress them).
  const canonicalItems = items.filter((i) => i.canonical);
  const similarGroups: SimilarDocGroup[] = [];
  for (let i = 0; i < canonicalItems.length; i++) {
    for (let j = i + 1; j < canonicalItems.length; j++) {
      const a = canonicalItems[i];
      const b = canonicalItems[j];
      if (a.category !== b.category) continue;
      const raw_a = rawByPath.get(a.path) as string;
      const raw_b = rawByPath.get(b.path) as string;
      const score = jaccard(normalizedLineSet(raw_a), normalizedLineSet(raw_b));
      if (score >= SIMILARITY_THRESHOLD && score < 1) {
        similarGroups.push({
          paths: [a.path, b.path].sort((x, y) => x.localeCompare(y)),
          similarity: Math.round(score * 100) / 100,
        });
      }
    }
  }
  similarGroups.sort((a, b) => a.paths[0].localeCompare(b.paths[0]));

  const canonicalReadme = canonicalItems.find((i) => i.category === "readme")?.path;

  return {
    documents: items,
    duplicate_groups: duplicateGroups,
    similar_groups: similarGroups,
    canonical_readme: canonicalReadme,
  };
}

/**
 * Given a set of key-doc paths and an inventory, return only the canonical
 * representative for each duplicate group (preserving order), plus a map from
 * suppressed duplicate path -> canonical path. Used to avoid repeated evidence
 * cards for equivalent document content (requirement 9).
 */
export function canonicalizeKeyDocs(
  keyDocs: string[],
  inventory: DocumentInventory | undefined
): { canonicalDocs: string[]; duplicateOf: Map<string, string> } {
  const duplicateOf = new Map<string, string>();
  if (!inventory) {
    return { canonicalDocs: [...keyDocs], duplicateOf };
  }
  for (const item of inventory.documents) {
    if (item.duplicate_of) duplicateOf.set(item.path, item.duplicate_of);
  }
  const seen = new Set<string>();
  const canonicalDocs: string[] = [];
  for (const doc of keyDocs) {
    const canonical = duplicateOf.get(doc) ?? doc;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    canonicalDocs.push(canonical);
  }
  return { canonicalDocs, duplicateOf };
}
