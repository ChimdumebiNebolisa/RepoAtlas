export function junitCoordinate(value: string): boolean {
  const [group = "", artifact = ""] = value.trim().toLowerCase().split(":");
  if (!group || !artifact) return false;
  return group.startsWith("org.junit") || /(?:^|-)junit(?:-|$)/.test(artifact);
}
