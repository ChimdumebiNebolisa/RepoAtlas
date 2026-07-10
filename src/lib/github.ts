/**
 * Canonical GitHub repository URL parsing and ref validation.
 *
 * For the first version we only accept canonical HTTPS github.com repository
 * URLs (optionally with a trailing `.git`). We deliberately do NOT try to
 * interpret arbitrary tree/blob URLs or generic git hosting URLs — a custom ref
 * must be supplied via a separate, validated `ref` field. This keeps the trust
 * boundary tiny and predictable (Phase 2 requirement 1).
 */

export interface GithubRepoRef {
  owner: string;
  repo: string;
}

// Owner: 1–39 chars, alphanumeric or hyphen, cannot start/end with hyphen.
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
// Repo: alphanumeric plus - _ . (GitHub also allows these); length capped.
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Parse a canonical GitHub repository URL.
 *
 * Accepted:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo.git
 *   (a single optional trailing slash is tolerated)
 *
 * Rejected: http (non-https), other hosts, tree/blob/subpaths, query strings,
 * fragments, userinfo, and non-canonical characters.
 */
export function parseGithubRepoUrl(input: string): GithubRepoRef | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  // Only the canonical host — no www., no gist., no enterprise hosts.
  if (url.hostname.toLowerCase() !== "github.com") return null;
  if (url.username || url.password) return null;
  if (url.search || url.hash) return null;
  if (url.port) return null;

  // Path must be exactly /owner/repo (with optional trailing slash).
  const segments = url.pathname.split("/").filter((s) => s.length > 0);
  if (segments.length !== 2) return null;

  const owner = segments[0];
  let repo = segments[1];
  if (repo.toLowerCase().endsWith(".git")) {
    repo = repo.slice(0, -4);
  }

  if (!OWNER_RE.test(owner)) return null;
  if (!REPO_RE.test(repo)) return null;
  if (repo === "." || repo === "..") return null;

  return { owner, repo };
}

/**
 * Validate a user-supplied branch/tag ref. Deliberately conservative: this is a
 * separate field, not derived from URL parsing. Follows a safe subset of
 * git-check-ref-format rules.
 */
export function isValidGitRef(ref: string): boolean {
  if (typeof ref !== "string") return false;
  const value = ref.trim();
  if (!value || value.length > 255) return false;
  // Allowed characters only.
  if (!/^[A-Za-z0-9._\-/]+$/.test(value)) return false;
  // Cannot contain "..", start with a dash or slash, end with slash or ".lock".
  if (value.includes("..")) return false;
  if (value.startsWith("-") || value.startsWith("/") || value.startsWith(".")) return false;
  if (value.endsWith("/") || value.endsWith(".lock") || value.endsWith(".")) return false;
  if (value.includes("//")) return false;
  if (value.includes("@{")) return false;
  return true;
}

/** GitHub REST API base for a repo. */
export function repoApiBase(owner: string, repo: string): string {
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}
