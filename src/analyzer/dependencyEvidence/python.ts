function normalizePythonPackage(value: string): string {
  return value.toLowerCase().replace(/[-_.]+/g, "-");
}

function pythonRequirementName(value: string): string | undefined {
  const match = value
    .trim()
    .match(/^([a-z0-9](?:[a-z0-9._-]*[a-z0-9])?)(?:\[[^\]]+\])?(?=\s*(?:$|[<>=!~;@]))/i);
  return match ? normalizePythonPackage(match[1]) : undefined;
}

export function requirementsHasDependency(content: string, dependency: string): boolean {
  const expected = normalizePythonPackage(dependency);
  return content.split(/\r?\n/).some((line) => {
    const declaration = line.split("#", 1)[0].trim();
    return declaration.length > 0 && pythonRequirementName(declaration) === expected;
  });
}

function stripTomlComment(line: string): string {
  let quote: "'" | '"' | undefined;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote === '"') {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = undefined;
      }
      continue;
    }
    if (quote === "'") {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "#") {
      return line.slice(0, index);
    }
  }

  return line;
}

function tomlStatements(content: string): string[] {
  const statements: string[] = [];
  let pending = "";
  let arrayDepth = 0;
  let quote: "'" | '"' | undefined;
  let escaped = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripTomlComment(rawLine).trim();
    if (!line && !pending) continue;
    pending = pending ? `${pending}\n${line}` : line;

    for (const character of line) {
      if (quote === '"') {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === quote) {
          quote = undefined;
        }
        continue;
      }
      if (quote === "'") {
        if (character === quote) quote = undefined;
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
      } else if (character === "[") {
        arrayDepth += 1;
      } else if (character === "]") {
        arrayDepth -= 1;
      }
    }

    if (!quote && arrayDepth === 0) {
      statements.push(pending);
      pending = "";
    } else if (arrayDepth < 0) {
      pending = "";
      arrayDepth = 0;
      quote = undefined;
    }
  }

  return statements;
}

function parseTomlStringArray(value: string): string[] | undefined {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return undefined;

  const values: string[] = [];
  let index = 1;
  while (index < trimmed.length - 1) {
    while (/\s|,/.test(trimmed[index] ?? "")) index += 1;
    if (index >= trimmed.length - 1) break;

    const quote = trimmed[index];
    if (quote !== '"' && quote !== "'") return undefined;
    index += 1;
    let item = "";
    let closed = false;
    while (index < trimmed.length - 1) {
      const character = trimmed[index];
      if (character === quote) {
        closed = true;
        index += 1;
        break;
      }
      if (quote === '"' && character === "\\") {
        const next = trimmed[index + 1];
        if (!next) return undefined;
        item += next;
        index += 2;
        continue;
      }
      item += character;
      index += 1;
    }
    if (!closed) return undefined;
    values.push(item);

    while (/\s/.test(trimmed[index] ?? "")) index += 1;
    if (index < trimmed.length - 1 && trimmed[index] !== ",") return undefined;
  }

  return values;
}

export function pyprojectHasDependency(content: string, dependency: string): boolean {
  const expected = normalizePythonPackage(dependency);
  let section = "";

  for (const statement of tomlStatements(content)) {
    const sectionMatch = statement.match(/^\[([^\[\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim().toLowerCase();
      continue;
    }

    const assignment = statement.match(/^([a-z0-9_.-]+)\s*=\s*([\s\S]+)$/i);
    if (!assignment) continue;
    const key = assignment[1];
    const value = assignment[2].trim();

    if (
      key.toLowerCase() === "dependencies" &&
      (section === "" || section === "project")
    ) {
      const declared = parseTomlStringArray(value);
      if (declared?.some((item) => pythonRequirementName(item) === expected)) return true;
    }

    if (section === "project.optional-dependencies") {
      const declared = parseTomlStringArray(value);
      if (declared?.some((item) => pythonRequirementName(item) === expected)) return true;
    }

    if (
      /^tool\.poetry(?:\.group\.[a-z0-9_.-]+)?\.dependencies$/i.test(section) &&
      normalizePythonPackage(key) === expected &&
      value.length > 0
    ) {
      return true;
    }
  }

  return false;
}

export function pytestIniDeclaresPytest(content: string): boolean {
  return content
    .split(/\r?\n/)
    .some((line) => /^\s*\[pytest\]\s*(?:[#;].*)?$/.test(line));
}
