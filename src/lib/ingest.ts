/**
 * Public repository-ingestion boundary.
 *
 * The coordinator deliberately stays small: input normalization, GitHub
 * transport, ZIP extraction, and temporary-workspace cleanup live in focused
 * modules with their own contracts.
 */

import { ingestFromGithub } from "@/lib/ingestGithub";
import { normalizeIngestInput } from "@/lib/ingestInput";
import { ingestFromZip } from "@/lib/ingestZip";
import type {
  IngestInput,
  IngestResult,
  LooseIngestInput,
} from "@/lib/ingestTypes";

export type { IngestInput, IngestResult, LooseIngestInput } from "@/lib/ingestTypes";
export { normalizeIngestInput, validateGithubUrl } from "@/lib/ingestInput";

export async function ingestRepo(
  input: LooseIngestInput,
  opts?: { signal?: AbortSignal }
): Promise<IngestResult> {
  const normalized: IngestInput = normalizeIngestInput(input);
  if (normalized.kind === "github") {
    return ingestFromGithub(normalized.githubUrl, normalized.ref, opts?.signal);
  }
  return ingestFromZip(normalized.zipRef, normalized.zipName, opts?.signal);
}
