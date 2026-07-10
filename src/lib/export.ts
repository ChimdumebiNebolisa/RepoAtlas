/**
 * Markdown export for Candidate Brief / Repo Analysis.
 */

import type { BriefAnswer, CandidateBrief, EvidenceRef, Report } from "@/types/report";
import { repoSourceLabel } from "./format";

/** Escape characters that have special meaning in Markdown inline text. */
export function escapeMarkdownInline(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/([`*_{}[\]()#])/g, "\\$1");
}

/** Escape table cell content (pipes, newlines, and inline Markdown). */
export function escapeTableCell(value: string): string {
  return escapeMarkdownInline(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function escapeInlineCodeContent(value: string): string {
  return value.replace(/`/g, "\\`");
}

function wrapInlineCode(value: string): string {
  return `\`${escapeInlineCodeContent(value)}\``;
}

function escapeMermaidLabel(label: string): string {
  return label
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\[\]<>#;]/g, " ");
}

function escapeMermaidId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function treeToMarkdown(node: Report["folder_map"], indent = 0): string {
  const prefix = "  ".repeat(indent);
  if (node.type === "file") {
    return `${prefix}- ${escapeMarkdownInline(node.path)}\n`;
  }
  let out = `${prefix}- **${escapeMarkdownInline(node.path)}**/\n`;
  for (const child of node.children ?? []) {
    out += treeToMarkdown(child, indent + 1);
  }
  return out;
}

function architectureToMarkdown(arch: Report["architecture"]): string {
  let out = "```mermaid\nflowchart TB\n";
  for (const n of arch.nodes) {
    const id = escapeMermaidId(n.id);
    out += `  ${id}["${escapeMermaidLabel(n.label)}"]\n`;
  }
  for (const e of arch.edges.filter((e) => e.from !== e.to)) {
    const from = escapeMermaidId(e.from);
    const to = escapeMermaidId(e.to);
    out += `  ${from} --> ${to}\n`;
  }
  out += "```\n\n";
  return out;
}

function evidenceList(ids: string[]): string {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return "";
  return ` Evidence: ${unique.map((id) => wrapInlineCode(id)).join(", ")}.`;
}

function briefAnswerToMarkdown(title: string, answer: BriefAnswer): string {
  let md = `### ${escapeMarkdownInline(title)}\n\n`;
  md += `${escapeMarkdownInline(answer.answer)}\n\n`;
  md += `- **Confidence**: ${answer.confidence}\n`;
  for (const bullet of answer.bullets) {
    md += `- ${escapeMarkdownInline(bullet)}\n`;
  }
  if (answer.evidence_refs.length > 0) {
    md += `- **Evidence**: ${answer.evidence_refs.map((id) => wrapInlineCode(id)).join(", ")}\n`;
  }
  md += "\n";
  return md;
}

function evidenceRefToMarkdown(ref: EvidenceRef): string {
  const parts = [`${ref.kind}: ${ref.label}`];
  if (ref.path) parts.push(`path=${ref.path}`);
  if (ref.command) parts.push(`command=${ref.command}`);
  if (ref.detail) parts.push(ref.detail);
  return `- ${wrapInlineCode(ref.id)} - ${escapeMarkdownInline(parts.join("; "))}\n`;
}

function candidateBriefToMarkdown(brief?: CandidateBrief): string {
  if (!brief) return "";

  let md = "## Candidate Brief\n\n";
  md += "### Repo Summary\n\n";
  md += `${escapeMarkdownInline(brief.repo_summary.headline)}\n\n`;
  md += `${escapeMarkdownInline(brief.repo_summary.plain_english)}\n\n`;
  md += `- **Confidence**: ${brief.repo_summary.confidence}\n`;
  md += `- **Primary evidence**: ${brief.repo_summary.primary_evidence
    .map((id) => wrapInlineCode(id))
    .join(", ")}\n\n`;

  md += "### Reading Path\n\n";
  if (brief.reading_path.length === 0) {
    md += "_No ranked reading path was generated._\n\n";
  } else {
    md += "| Order | Path | Why | Evidence |\n";
    md += "|-------|------|-----|----------|\n";
    for (const item of brief.reading_path) {
      md += `| ${item.order} | ${wrapInlineCode(item.path)} | ${escapeTableCell(item.why)} | ${item.evidence_refs
        .map((id) => wrapInlineCode(id))
        .join(", ")} |\n`;
    }
    md += "\n";
  }

  md += "### Interview Talking Points\n\n";
  md += briefAnswerToMarkdown(
    "Walk me through this codebase",
    brief.interview_talking_points.walk_me_through_codebase
  );
  md += briefAnswerToMarkdown(
    "What are the riskiest areas?",
    brief.interview_talking_points.riskiest_areas
  );
  md += briefAnswerToMarkdown(
    "What would you improve first?",
    brief.interview_talking_points.improve_first
  );
  md += briefAnswerToMarkdown(
    "How would you contribute in your first week?",
    brief.interview_talking_points.first_week_contribution
  );

  md += "### First PR Plan\n\n";
  for (const idea of brief.first_pr_plan) {
    md += `- **${escapeMarkdownInline(idea.title)}** (${idea.risk} risk): ${escapeMarkdownInline(idea.rationale)}`;
    if (idea.suggested_files.length > 0) {
      md += ` Suggested files: ${idea.suggested_files.map((file) => wrapInlineCode(file)).join(", ")}.`;
    }
    md += evidenceList(idea.evidence_refs);
    md += "\n";
  }
  md += "\n";

  md += "### Resume / LinkedIn Bullets\n\n";
  for (const bullet of brief.resume_bullets) {
    md += `- **${escapeMarkdownInline(bullet.audience)}**: ${escapeMarkdownInline(bullet.text)}${evidenceList(bullet.evidence_refs)}\n`;
  }
  md += "\n";

  md += "### Candidate Brief Warnings\n\n";
  if (brief.warnings.length === 0) {
    md += "_No Candidate Brief warnings._\n\n";
  } else {
    for (const warning of brief.warnings) {
      md += `- ${escapeMarkdownInline(warning.message)}${evidenceList(warning.evidence_refs ?? [])}\n`;
    }
    md += "\n";
  }

  md += "### Evidence References\n\n";
  for (const ref of brief.evidence_refs) {
    md += evidenceRefToMarkdown(ref);
  }
  md += "\n";

  return md;
}

export function exportReportToMarkdown(report: Report): string {
  let md = `# Repo Analysis: ${escapeMarkdownInline(report.repo_metadata.name)}\n\n`;
  md += `- **Source**: ${escapeMarkdownInline(repoSourceLabel(report.repo_metadata.url))}\n`;
  md += `- **Branch**: ${escapeMarkdownInline(report.repo_metadata.branch)}\n`;
  md += `- **Analyzed**: ${report.repo_metadata.analyzed_at}\n\n`;

  md += candidateBriefToMarkdown(report.candidate_brief);

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
    md += `| ${wrapInlineCode(item.path)} | ${item.score} | ${escapeTableCell(item.explanation)} |\n`;
  }
  md += "\n";

  md += "## Danger Zones\n\n";
  md += "| Path | Score | Breakdown |\n";
  md += "|------|-------|----------|\n";
  for (const item of report.danger_zones) {
    md += `| ${wrapInlineCode(item.path)} | ${item.score} | ${escapeTableCell(item.breakdown)} |\n`;
  }
  md += "\n";

  md += "## Run & Contribute\n\n";
  md += "### Run Commands\n\n";
  for (const cmd of report.run_commands) {
    md += `- ${wrapInlineCode(cmd.command)} (from ${escapeMarkdownInline(cmd.source)})${cmd.description ? ` - ${escapeMarkdownInline(cmd.description)}` : ""}\n`;
  }
  md += "\n### Key Docs\n\n";
  for (const doc of report.contribute_signals.key_docs) {
    md += `- ${escapeMarkdownInline(doc)}\n`;
  }
  md += "\n### CI Configs\n\n";
  for (const ci of report.contribute_signals.ci_configs) {
    md += `- ${escapeMarkdownInline(ci)}\n`;
  }

  if (report.warnings.length > 0) {
    md += "\n## Warnings\n\n";
    for (const w of report.warnings) {
      md += `- ${escapeMarkdownInline(w)}\n`;
    }
  }

  return md;
}
