import { junitCoordinate } from "./junit";

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
