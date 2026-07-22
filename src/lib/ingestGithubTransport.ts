import fs from "fs";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { repoApiBase } from "@/lib/github";
import {
  DOWNLOAD_TIMEOUT_MS,
  GITHUB_API_TIMEOUT_MS,
  MAX_COMPRESSED_BYTES,
} from "@/lib/ingestLimits";

const ALLOWED_DOWNLOAD_HOSTS = new Set([
  "github.com",
  "codeload.github.com",
  "objects.githubusercontent.com",
]);

function isAbortOrTimeout(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("abort") || lower.includes("timeout") || lower.includes("timed out");
}

export function wrapGithubNetworkError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : "Unknown error";
  if (isAbortOrTimeout(message)) {
    return new AppError({
      code: ERROR_CODES.DOWNLOAD_TIMEOUT,
      status: 504,
      message: "GitHub request timed out.",
      meta: { rawMessage: message },
      cause: error,
    });
  }
  return new AppError({
    code: ERROR_CODES.CLONE_FAILED,
    status: 502,
    message: "Could not reach GitHub.",
    meta: { rawMessage: message },
    cause: error,
  });
}

async function githubApiFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GITHUB_API_TIMEOUT_MS);
  try {
    // Public repositories only. Never attach a server GitHub token.
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Distinguish GitHub API HTTP failures into stable product error codes. */
export function mapGithubApiError(response: Response, context: "repo" | "ref"): AppError {
  const remaining = response.headers.get("x-ratelimit-remaining");
  const isRateLimited =
    response.status === 429 || (response.status === 403 && remaining === "0");

  if (isRateLimited) {
    return new AppError({
      code: ERROR_CODES.RATE_LIMITED,
      status: 429,
      message: "GitHub rate limit reached. Try again later.",
      meta: { status: response.status },
    });
  }
  if (response.status === 404) {
    return new AppError({
      code: context === "ref" ? ERROR_CODES.MISSING_REF : ERROR_CODES.REPO_NOT_FOUND,
      status: 404,
      message:
        context === "ref"
          ? "Requested branch or tag was not found."
          : "Repository not found (it may be private).",
      meta: { status: response.status },
    });
  }
  if (response.status === 403 || response.status === 451) {
    return new AppError({
      code: ERROR_CODES.REPO_PRIVATE,
      status: 403,
      message: "Repository is not accessible (private or restricted).",
      meta: { status: response.status },
    });
  }
  if (response.status === 422) {
    return new AppError({
      code: ERROR_CODES.MISSING_REF,
      status: 404,
      message: "Requested branch or tag was not found.",
      meta: { status: response.status },
    });
  }
  return new AppError({
    code: ERROR_CODES.CLONE_FAILED,
    status: 502,
    message: "Could not fetch repository information from GitHub.",
    meta: { status: response.status },
  });
}

export async function resolveDefaultBranch(owner: string, repo: string): Promise<string> {
  let response: Response;
  try {
    response = await githubApiFetch(repoApiBase(owner, repo));
  } catch (error) {
    throw wrapGithubNetworkError(error);
  }
  if (!response.ok) throw mapGithubApiError(response, "repo");
  const data = (await response.json()) as { default_branch?: string; private?: boolean };
  if (data?.private) {
    throw new AppError({
      code: ERROR_CODES.REPO_PRIVATE,
      status: 403,
      message: "Repository is private.",
    });
  }
  return data?.default_branch ?? "main";
}

export async function resolveCommitSha(
  owner: string,
  repo: string,
  ref: string
): Promise<string> {
  const url = `${repoApiBase(owner, repo)}/commits/${encodeURIComponent(ref)}`;
  let response: Response;
  try {
    response = await githubApiFetch(url);
  } catch (error) {
    throw wrapGithubNetworkError(error);
  }
  if (!response.ok) throw mapGithubApiError(response, "ref");
  const data = (await response.json()) as { sha?: string };
  if (!data?.sha) {
    throw new AppError({
      code: ERROR_CODES.MISSING_REF,
      status: 404,
      message: "Could not resolve a commit for the requested ref.",
    });
  }
  return data.sha;
}

function writeChunk(stream: fs.WriteStream, chunk: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(chunk, (error) => (error ? reject(error) : resolve()));
  });
}

/** Stream a GitHub archive to disk with host, timeout, and size protection. */
export async function downloadArchiveToFile(
  url: string,
  destFile: string,
  parentSignal?: AbortSignal
): Promise<void> {
  const controller = new AbortController();
  const abortDownload = () => controller.abort();
  const timeoutId = setTimeout(abortDownload, DOWNLOAD_TIMEOUT_MS);
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener("abort", abortDownload, { once: true });
  }

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: { Accept: "application/vnd.github+json" },
      });
    } catch (error) {
      throw wrapGithubNetworkError(error);
    }

    try {
      const finalHost = new URL(response.url || url).hostname.toLowerCase();
      if (!ALLOWED_DOWNLOAD_HOSTS.has(finalHost)) {
        throw new AppError({
          code: ERROR_CODES.CLONE_FAILED,
          status: 502,
          message: "Archive download redirected to an unexpected host.",
          meta: { host: finalHost },
        });
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      // The initial URL is already trusted when a mock omits response.url.
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new AppError({
          code: ERROR_CODES.MISSING_REF,
          status: 404,
          message: "Archive not found for the resolved commit.",
          meta: { status: response.status },
        });
      }
      throw new AppError({
        code: ERROR_CODES.CLONE_FAILED,
        status: 502,
        message: "Could not download the repository archive.",
        meta: { status: response.status },
      });
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (!Number.isNaN(size) && size > MAX_COMPRESSED_BYTES) {
        throw new AppError({
          code: ERROR_CODES.REPO_TOO_LARGE,
          status: 413,
          message: "Repository archive exceeds the size limit.",
          meta: { contentLength: size },
        });
      }
    }

    if (!response.body) {
      throw new AppError({
        code: ERROR_CODES.CLONE_FAILED,
        status: 502,
        message: "Empty response body from GitHub archive download.",
      });
    }

    const output = fs.createWriteStream(destFile);
    const reader = response.body.getReader();
    let total = 0;
    let streamFailed = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.length;
        if (total > MAX_COMPRESSED_BYTES) {
          await reader.cancel().catch(() => undefined);
          throw new AppError({
            code: ERROR_CODES.REPO_TOO_LARGE,
            status: 413,
            message: "Repository archive exceeds the size limit.",
          });
        }
        await writeChunk(output, value);
      }
    } catch (error) {
      streamFailed = true;
      output.destroy();
      if (error instanceof AppError) throw error;
      throw wrapGithubNetworkError(error);
    } finally {
      // A destroyed stream never invokes an `end` callback. Waiting for it on
      // an interrupted download would strand the request until the outer
      // analysis timeout instead of returning the mapped terminal error.
      if (!streamFailed) {
        await new Promise<void>((resolve) => output.end(resolve));
      }
    }
  } finally {
    clearTimeout(timeoutId);
    parentSignal?.removeEventListener("abort", abortDownload);
  }
}
