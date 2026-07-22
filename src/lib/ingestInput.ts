import path from "path";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { IngestInput, LooseIngestInput } from "@/lib/ingestTypes";

// Legacy permissive parser retained for internal owner/repo extraction such as
// commit-history churn. It is not on the request-validation path.
const GITHUB_URL_RE =
  /^https?:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/]+))?\/?$/;

export function validateGithubUrl(
  url: string
): { owner: string; repo: string; ref?: string } | null {
  const match = url.trim().match(GITHUB_URL_RE);
  if (!match) return null;
  const [, owner, repo, ref] = match;
  if (!owner || !repo) return null;
  return { owner, repo, ref: ref ?? undefined };
}

export function normalizeIngestInput(input: LooseIngestInput): IngestInput {
  const wantsGithub = input.kind === "github" || (!input.kind && !!input.githubUrl);
  if (wantsGithub) {
    if (!input.githubUrl) {
      throw new AppError({
        code: ERROR_CODES.INVALID_INPUT,
        status: 400,
        message: "Provide a GitHub repository URL.",
      });
    }
    return { kind: "github", githubUrl: input.githubUrl, ref: input.ref };
  }
  if (input.zipRef) {
    return { kind: "zip", zipRef: input.zipRef, zipName: input.zipName };
  }
  throw new AppError({
    code: ERROR_CODES.INVALID_INPUT,
    status: 400,
    message: "Provide a zip upload or a GitHub repository URL.",
  });
}

export function getUploadedRepoName(zipPath: string, zipName?: string): string {
  const preferredName = zipName?.trim();
  const candidate = preferredName || path.basename(zipPath, path.extname(zipPath));
  return path.basename(candidate, path.extname(candidate)) || "uploaded-repo";
}
