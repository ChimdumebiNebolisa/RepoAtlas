/**
 * Import-statement scanner for Python sources.
 * Not a full AST — tracks strings/comments enough to avoid the worst false positives,
 * and expands `from pkg import name` into both `pkg` and `pkg.name` for resolution.
 */

function isIdentifierStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch);
}

function isIdentifierChar(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

function readIdentifier(source: string, start: number): { value: string; next: number } {
  let index = start;
  while (index < source.length && isIdentifierChar(source[index]!)) index += 1;
  return { value: source.slice(start, index), next: index };
}

function skipSpaces(source: string, start: number): number {
  let index = start;
  while (index < source.length && /[ \t]/.test(source[index]!)) index += 1;
  return index;
}

function skipLineContinuation(source: string, start: number): number {
  let index = start;
  if (source[index] === "\\" && (source[index + 1] === "\n" || source[index + 1] === "\r")) {
    index += 1;
    if (source[index] === "\r" && source[index + 1] === "\n") index += 2;
    else index += 1;
  }
  return index;
}

function readDottedName(source: string, start: number): { value: string; next: number } | null {
  let index = skipSpaces(source, start);
  if (index >= source.length || !isIdentifierStart(source[index]!)) return null;
  const parts: string[] = [];
  while (index < source.length && isIdentifierStart(source[index]!)) {
    const ident = readIdentifier(source, index);
    parts.push(ident.value);
    index = skipSpaces(source, ident.next);
    if (source[index] !== ".") break;
    index = skipSpaces(source, index + 1);
  }
  return parts.length ? { value: parts.join("."), next: index } : null;
}

function readImportNameList(source: string, start: number): { names: string[]; next: number } {
  let index = skipSpaces(source, start);
  const names: string[] = [];
  let parenDepth = 0;

  const pushName = (raw: string) => {
    const cleaned = raw.replace(/\s+as\s+\S+$/i, "").trim();
    if (cleaned && cleaned !== "*") names.push(cleaned.split(/\s+/)[0]!);
  };

  if (source[index] === "(") {
    parenDepth = 1;
    index += 1;
  }

  let current = "";
  while (index < source.length) {
    const ch = source[index]!;
    if (ch === "(") {
      parenDepth += 1;
      index += 1;
      continue;
    }
    if (ch === ")" && parenDepth > 0) {
      parenDepth -= 1;
      index += 1;
      if (parenDepth === 0) {
        if (current.trim()) pushName(current);
        break;
      }
      continue;
    }
    if ((ch === "#" || ch === "\n" || ch === "\r") && parenDepth === 0) break;
    if (ch === "," && (parenDepth === 0 || parenDepth === 1)) {
      if (current.trim()) pushName(current);
      current = "";
      index += 1;
      index = skipSpaces(source, index);
      index = skipLineContinuation(source, index);
      continue;
    }
    if (ch === "\\" ) {
      index = skipLineContinuation(source, index);
      continue;
    }
    current += ch;
    index += 1;
  }
  if (current.trim()) pushName(current);
  return { names, next: index };
}

/**
 * Extract import module specs from Python source.
 */
export function extractImportSpecifiers(content: string): string[] {
  const specs: string[] = [];
  const seen = new Set<string>();
  const add = (spec: string) => {
    const trimmed = spec.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    specs.push(trimmed);
  };

  let index = 0;
  let atLineStart = true;
  let stringQuote: string | null = null;
  let triple = false;

  while (index < content.length) {
    const ch = content[index]!;

    if (stringQuote) {
      if (ch === "\\" && !triple) {
        index += 2;
        continue;
      }
      if (triple) {
        if (
          ch === stringQuote &&
          content[index + 1] === stringQuote &&
          content[index + 2] === stringQuote
        ) {
          stringQuote = null;
          triple = false;
          index += 3;
          continue;
        }
        index += 1;
        continue;
      }
      if (ch === stringQuote) {
        stringQuote = null;
        index += 1;
        continue;
      }
      index += 1;
      continue;
    }

    if (ch === "#" && atLineStart) {
      while (index < content.length && content[index] !== "\n") index += 1;
      continue;
    }

    if (ch === "'" || ch === '"') {
      if (content[index + 1] === ch && content[index + 2] === ch) {
        stringQuote = ch;
        triple = true;
        index += 3;
        atLineStart = false;
        continue;
      }
      stringQuote = ch;
      triple = false;
      index += 1;
      atLineStart = false;
      continue;
    }

    if (ch === "\n") {
      atLineStart = true;
      index += 1;
      continue;
    }

    if (atLineStart && /[ \t]/.test(ch)) {
      index += 1;
      continue;
    }

    if (atLineStart && content.startsWith("import", index) && !isIdentifierChar(content[index + 6] ?? "")) {
      index = skipSpaces(content, index + 6);
      const list = readImportNameList(content, index);
      for (const name of list.names) add(name);
      index = list.next;
      atLineStart = false;
      continue;
    }

    if (atLineStart && content.startsWith("from", index) && !isIdentifierChar(content[index + 4] ?? "")) {
      index = skipSpaces(content, index + 4);
      let relativeDots = 0;
      while (content[index] === ".") {
        relativeDots += 1;
        index += 1;
      }
      index = skipSpaces(content, index);
      let modulePath = "";
      // Bare relative form: `from . import x` — do not consume the `import` keyword as a module.
      if (!(content.startsWith("import", index) && !isIdentifierChar(content[index + 6] ?? ""))) {
        const moduleName = readDottedName(content, index);
        modulePath = moduleName?.value ?? "";
        if (moduleName) index = moduleName.next;
        index = skipSpaces(content, index);
      }
      if (content.startsWith("import", index) && !isIdentifierChar(content[index + 6] ?? "")) {
        index = skipSpaces(content, index + 6);
        const list = readImportNameList(content, index);
        if (relativeDots > 0) {
          const base = ".".repeat(relativeDots) + modulePath;
          if (modulePath) add(base);
          for (const name of list.names) {
            add(modulePath ? `${base}.${name}` : `${".".repeat(relativeDots)}${name}`);
          }
        } else if (modulePath) {
          add(modulePath);
          for (const name of list.names) add(`${modulePath}.${name}`);
        }
        index = list.next;
      }
      atLineStart = false;
      continue;
    }

    if (!/[ \t]/.test(ch)) atLineStart = false;
    index += 1;
  }

  return specs;
}
