const MAX_REPOSITORY_SLUG_LENGTH = 60;
const ISO_DATE_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:T.*)?$/;

export function slugifyRepoName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_REPOSITORY_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return slug || "repo";
}

function analyzedDate(value: string): string {
  const match = ISO_DATE_PATTERN.exec(value.trim());
  if (!match) return "undated";

  const date = match[1]!;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date
    ? "undated"
    : date;
}

export function buildExportFilename(opts: {
  repoName: string;
  analyzedAt: string;
  ext: "md" | "pdf" | "png";
}): string {
  const date = analyzedDate(opts.analyzedAt);
  const slug = slugifyRepoName(opts.repoName);
  return `repoatlas-candidate-brief-${slug}-${date}.${opts.ext}`;
}
