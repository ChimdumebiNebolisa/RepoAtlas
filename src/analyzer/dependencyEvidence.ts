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

function junitCoordinate(value: string): boolean {
  const [group = "", artifact = ""] = value.trim().toLowerCase().split(":");
  if (!group || !artifact) return false;
  return group.startsWith("org.junit") || /(?:^|-)junit(?:-|$)/.test(artifact);
}

export function pomDeclaresJUnit(content: string): boolean {
  const withoutText = content
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  if (
    withoutText.includes("<!--") ||
    withoutText.includes("-->") ||
    withoutText.includes("<![CDATA[") ||
    withoutText.includes("]]>")
  ) {
    return false;
  }

  for (const dependenciesMatch of withoutText.matchAll(
    /<dependencies(?:\s[^>]*)?>([\s\S]*?)<\/dependencies\s*>/gi
  )) {
    for (const dependencyMatch of dependenciesMatch[1].matchAll(
      /<dependency(?:\s[^>]*)?>([\s\S]*?)<\/dependency\s*>/gi
    )) {
      const dependency = dependencyMatch[1];
      const group =
        dependency.match(/<groupId(?:\s[^>]*)?>\s*([^<]+?)\s*<\/groupId\s*>/i)?.[1] ?? "";
      const artifact =
        dependency.match(/<artifactId(?:\s[^>]*)?>\s*([^<]+?)\s*<\/artifactId\s*>/i)?.[1] ?? "";
      if (junitCoordinate(`${group}:${artifact}`)) return true;
    }
  }

  return false;
}

function stripScriptComments(content: string): string {
  let result = "";
  let quote: "'" | '"' | undefined;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  let tripleQuote: "'''" | '"""' | undefined;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const next = content[index + 1];
    const nextThree = content.slice(index, index + 3);

    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
        result += character;
      }
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      } else if (character === "\n") {
        result += character;
      }
      continue;
    }
    if (tripleQuote) {
      if (nextThree === tripleQuote) {
        tripleQuote = undefined;
        index += 2;
      } else if (character === "\n") {
        result += character;
      }
      continue;
    }
    if (quote === '"') {
      result += character;
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
      result += character;
      if (character === quote) quote = undefined;
      continue;
    }
    if (nextThree === '"""' || nextThree === "'''") {
      tripleQuote = nextThree;
      index += 2;
    } else if (character === '"' || character === "'") {
      quote = character;
      result += character;
    } else if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
    } else if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
    } else {
      result += character;
    }
  }

  return result;
}

export function gradleDeclaresJUnit(content: string): boolean {
  const configuration =
    "(?:test|androidTest|testFixtures)(?:Implementation|Api|CompileOnly|RuntimeOnly)";
  const callPattern = new RegExp(
    `^\\s*${configuration}\\s*\\(\\s*(['"])([^'"]+)\\1\\s*\\)\\s*;?\\s*$`,
    "i"
  );
  const platformCallPattern = new RegExp(
    `^\\s*${configuration}\\s*\\(\\s*platform\\s*\\(\\s*(['"])([^'"]+)\\1\\s*\\)\\s*\\)\\s*;?\\s*$`,
    "i"
  );
  const groovyPattern = new RegExp(
    `^\\s*${configuration}\\s+(['"])([^'"]+)\\1\\s*;?\\s*$`,
    "i"
  );

  return stripScriptComments(content)
    .split(/\r?\n/)
    .some((line) => {
      const match =
        line.match(callPattern) ??
        line.match(platformCallPattern) ??
        line.match(groovyPattern);
      return match ? junitCoordinate(match[2]) : false;
    });
}
