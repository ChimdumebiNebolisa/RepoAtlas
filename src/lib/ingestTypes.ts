export interface IngestResult {
  path: string;
  name: string;
  branch: string | null;
  cloneHash: string | null;
  url?: string;
  cleanup?: () => Promise<void>;
}

export type IngestInput =
  | { kind: "zip"; zipRef: string; zipName?: string }
  | { kind: "github"; githubUrl: string; ref?: string };

/** Loose shape used by internal callers and normalized before use. */
export interface LooseIngestInput {
  kind?: "zip" | "github";
  githubUrl?: string;
  ref?: string;
  zipRef?: string;
  zipName?: string;
}
