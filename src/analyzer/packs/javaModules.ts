import fs from "fs";
import path from "path";

export interface JavaModuleDiscovery {
  maven: string[];
  gradle: string[];
}

function uniqueMatches(content: string, pattern: RegExp): string[] {
  const modules: string[] = [];
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content))) {
    const moduleName = match[1].trim();
    if (moduleName && !modules.includes(moduleName)) modules.push(moduleName);
  }
  return modules;
}

function readManifest(workspacePath: string, name: string): string | null {
  const manifestPath = path.join(workspacePath, name);
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return fs.readFileSync(manifestPath, "utf-8");
  } catch {
    return null;
  }
}

export function detectMavenModules(workspacePath: string): string[] {
  const content = readManifest(workspacePath, "pom.xml");
  if (content === null) return [];
  return uniqueMatches(content, /<module>([^<]+)<\/module>/g);
}

export function detectGradleModules(workspacePath: string): string[] {
  for (const name of ["settings.gradle", "settings.gradle.kts"]) {
    const content = readManifest(workspacePath, name);
    if (content === null) continue;
    return uniqueMatches(content, /include\s*\(\s*["']([^"']+)["']\s*\)/g);
  }
  return [];
}

export function discoverJavaModules(workspacePath: string): JavaModuleDiscovery {
  return {
    maven: detectMavenModules(workspacePath),
    gradle: detectGradleModules(workspacePath),
  };
}
