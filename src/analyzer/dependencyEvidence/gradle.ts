import { junitCoordinate } from "./junit";

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

export function gradleDeclaresJUnit(
  content: string,
  dialect: "groovy" | "kotlin"
): boolean {
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
        (dialect === "groovy" ? line.match(groovyPattern) : null);
      return match ? junitCoordinate(match[2]) : false;
    });
}
