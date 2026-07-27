export const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
export const PYTHON_EXTENSION = ".py";
export const JAVA_EXTENSION = ".java";

export interface StartHereCandidate {
  path: string;
  rawScore: number;
  reasons: string[];
}

export function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

export function addReason(candidate: StartHereCandidate, reason: string): void {
  if (!candidate.reasons.includes(reason)) {
    candidate.reasons.push(reason);
  }
}

export function computeEntrypointDistance(
  entrypoints: Set<string>,
  imports: Map<string, Set<string>>
): Map<string, number> {
  const distance = new Map<string, number>();
  const queue: string[] = [];

  for (const entrypoint of entrypoints) {
    distance.set(entrypoint, 0);
    queue.push(entrypoint);
  }

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    const currentDistance = distance.get(current) ?? 0;
    for (const target of imports.get(current) ?? []) {
      if (distance.has(target)) continue;
      distance.set(target, currentDistance + 1);
      queue.push(target);
    }
  }

  return distance;
}
