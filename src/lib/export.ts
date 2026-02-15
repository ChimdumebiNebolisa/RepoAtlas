/**
 * Markdown export for Repo Brief.
 */

import type { Report } from "@/types/report";

function treeToMarkdown(node: Report["folder_map"], indent = 0): string {
  const prefix = "  ".repeat(indent);
  if (node.type === "file") {
    return `${prefix}- ${node.path}\n`;
  }
  let out = `${prefix}- **${node.path}**/\n`;
  for (const child of node.children ?? []) {
    out += treeToMarkdown(child, indent + 1);
  }
  return out;
}

function architectureToMarkdown(arch: Report["architecture"]): string {
  let out = "```mermaid\nflowchart TB\n";
  for (const n of arch.nodes) {
    const id = n.id.replace(/[^a-zA-Z0-9_]/g, "_");
    out += `  ${id}["${n.label}"]\n`;
  }
  for (const e of arch.edges.filter((e) => e.from !== e.to)) {
    const from = e.from.replace(/[^a-zA-Z0-9_]/g, "_");
    const to = e.to.replace(/[^a-zA-Z0-9_]/g, "_");
    out += `  ${from} --> ${to}\n`;
  }
  out += "```\n\n";
  return out;
}

export function exportReportToMarkdown(report: Report): string {
  let md = `# Repo Brief: ${report.repo_metadata.name}\n\n`;
  md += `- **URL**: ${report.repo_metadata.url}\n`;
  md += `- **Branch**: ${report.repo_metadata.branch}\n`;
  md += `- **Analyzed**: ${report.repo_metadata.analyzed_at}\n\n`;

  md += "## Folder Map\n\n";
  md += treeToMarkdown(report.folder_map);

  md += "\n## Architecture\n\n";
  if (report.architecture.nodes.length > 0) {
    md += architectureToMarkdown(report.architecture);
  } else {
    md += "_No architecture data_\n\n";
  }

  md += "## Start Here\n\n";
  md += "| Path | Score | Signals |\n";
  md += "|------|-------|---------|\n";
  for (const item of report.start_here) {
    md += `| \`${item.path}\` | ${item.score} | ${item.explanation} |\n`;
  }
  md += "\n";

  md += "## Danger Zones\n\n";
  md += "| Path | Score | Breakdown |\n";
  md += "|------|-------|----------|\n";
  for (const item of report.danger_zones) {
    md += `| \`${item.path}\` | ${item.score} | ${item.breakdown} |\n`;
  }
  md += "\n";

  md += "## Run & Contribute\n\n";
  md += "### Run Commands\n\n";
  for (const cmd of report.run_commands) {
    md += `- \`${cmd.command}\` (from ${cmd.source})${cmd.description ? ` — ${cmd.description}` : ""}\n`;
  }
  md += "\n### Key Docs\n\n";
  for (const doc of report.contribute_signals.key_docs) {
    md += `- ${doc}\n`;
  }
  md += "\n### CI Configs\n\n";
  for (const ci of report.contribute_signals.ci_configs) {
    md += `- ${ci}\n`;
  }

  if (report.warnings.length > 0) {
    md += "\n## Warnings\n\n";
    for (const w of report.warnings) {
      md += `- ${w}\n`;
    }
  }

  return md;
}
