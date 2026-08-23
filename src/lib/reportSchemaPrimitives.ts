const MAX_FOLDER_VALIDATION_DEPTH = 64;

export function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isDisplayedScore(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 100;
}

export function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

export function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export function isOneOf<const T extends readonly string[]>(
  value: unknown,
  choices: T,
): value is T[number] {
  return (
    typeof value === "string" && choices.some((choice) => choice === value)
  );
}

export function isConfidence(value: unknown): boolean {
  return isOneOf(value, ["high", "medium", "low"] as const);
}

export function uniqueIds(
  items: Array<Record<string, unknown>>,
): Set<string> | null {
  const ids = new Set<string>();
  for (const item of items) {
    if (typeof item.id !== "string" || item.id.length === 0 || ids.has(item.id)) {
      return null;
    }
    ids.add(item.id);
  }
  return ids;
}

export function isRepoMetadata(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.url === "string" &&
    typeof value.branch === "string" &&
    (value.clone_hash === null || typeof value.clone_hash === "string") &&
    typeof value.analyzed_at === "string"
  );
}

export function isFolderMapNode(value: unknown): boolean {
  const pending: Array<{ value: unknown; depth: number }> = [
    { value, depth: 0 },
  ];
  const seen = new Set<object>();

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || !isObject(current.value) || seen.has(current.value))
      return false;
    if (current.depth > MAX_FOLDER_VALIDATION_DEPTH) return false;
    seen.add(current.value);

    if (
      typeof current.value.path !== "string" ||
      (current.value.type !== "file" && current.value.type !== "dir")
    ) {
      return false;
    }
    if (
      current.value.truncated != null &&
      typeof current.value.truncated !== "boolean"
    )
      return false;
    if (current.value.children != null) {
      if (!Array.isArray(current.value.children)) return false;
      for (const child of current.value.children) {
        pending.push({ value: child, depth: current.depth + 1 });
      }
    }
  }

  return true;
}

export function isStartHereItem(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.path === "string" &&
    isDisplayedScore(value.score) &&
    typeof value.explanation === "string"
  );
}

export function isDangerZoneItem(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (
    typeof value.path !== "string" ||
    !isDisplayedScore(value.score) ||
    typeof value.breakdown !== "string" ||
    !isObject(value.metrics)
  ) {
    return false;
  }
  for (const key of [
    "size",
    "fan_in",
    "fan_out",
    "complexity",
    "test_proximity",
    "churn",
  ] as const) {
    if (value.metrics[key] != null && !isFiniteNumber(value.metrics[key]))
      return false;
  }
  return true;
}

export function isRunCommand(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.source === "string" &&
    typeof value.command === "string" &&
    (value.description == null || typeof value.description === "string")
  );
}

export function isContributeSignals(value: unknown): boolean {
  return (
    isObject(value) &&
    isStringArray(value.key_docs) &&
    isStringArray(value.ci_configs)
  );
}

export function isCommitInsights(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (!isOneOf(value.mode, ["local_git", "github_api", "unavailable"] as const))
    return false;
  return (
    isStringArray(value.recent_work_areas) &&
    isStringArray(value.high_churn_files) &&
    Array.isArray(value.co_changed_pairs) &&
    value.co_changed_pairs.every(
      (pair) =>
        isObject(pair) &&
        Array.isArray(pair.files) &&
        pair.files.length === 2 &&
        pair.files.every((file) => typeof file === "string") &&
        isNonNegativeInteger(pair.count),
    ) &&
    isStringArray(value.evidence_refs)
  );
}
