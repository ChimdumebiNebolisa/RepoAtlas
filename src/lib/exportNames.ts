export function slugifyRepoName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "repo";
}

export function buildExportFilename(opts: {
  repoName: string;
  analyzedAt: string;
  ext: "md" | "pdf" | "png";
}): string {
  const date = opts.analyzedAt.slice(0, 10);
  const slug = slugifyRepoName(opts.repoName);
  return `repoatlas-candidate-brief-${slug}-${date}.${opts.ext}`;
}
