/**
 * Markdown export for Repo Brief.
 */

import type { BriefAnswer, CandidateBrief, EvidenceRef, Report } from "@/types/report";

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

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function evidenceList(ids: string[]): string {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return "";
  return ` Evidence: ${unique.map((id) => `\`${id}\``).join(", ")}.`;
}

function briefAnswerToMarkdown(title: string, answer: BriefAnswer): string {
  let md = `### ${title}\n\n`;
  md += `${answer.answer}\n\n`;
  md += `- **Confidence**: ${answer.confidence}\n`;
  for (const bullet of answer.bullets) {
    md += `- ${bullet}\n`;
  }
  if (answer.evidence_refs.length > 0) {
    md += `- **Evidence**: ${answer.evidence_refs.map((id) => `\`${id}\``).join(", ")}\n`;
  }
  md += "\n";
  return md;
}

function evidenceRefToMarkdown(ref: EvidenceRef): string {
  const parts = [`${ref.kind}: ${ref.label}`];
  if (ref.path) parts.push(`path=${ref.path}`);
  if (ref.command) parts.push(`command=${ref.command}`);
  if (ref.detail) parts.push(ref.detail);
  return `- \`${ref.id}\` - ${parts.join("; ")}\n`;
}

function candidateBriefToMarkdown(brief?: CandidateBrief): string {
  if (!brief) return "";

  let md = "## Candidate Brief\n\n";
  md += "### Repo Summary\n\n";
  md += `${brief.repo_summary.headline}\n\n`;
  md += `${brief.repo_summary.plain_english}\n\n`;
  md += `- **Confidence**: ${brief.repo_summary.confidence}\n`;
  md += `- **Primary evidence**: ${brief.repo_summary.primary_evidence
    .map((id) => `\`${id}\``)
    .join(", ")}\n\n`;

  md += "### Reading Path\n\n";
  if (brief.reading_path.length === 0) {
    md += "_No ranked reading path was generated._\n\n";
  } else {
    md += "| Order | Path | Why | Evidence |\n";
    md += "|-------|------|-----|----------|\n";
    for (const item of brief.reading_path) {
      md += `| ${item.order} | \`${item.path}\` | ${escapeTableCell(item.why)} | ${item.evidence_refs
        .map((id) => `\`${id}\``)
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
    md += `- **${idea.title}** (${idea.risk} risk): ${idea.rationale}`;
    if (idea.suggested_files.length > 0) {
      md += ` Suggested files: ${idea.suggested_files.map((file) => `\`${file}\``).join(", ")}.`;
    }
    md += evidenceList(idea.evidence_refs);
    md += "\n";
  }
  md += "\n";

  md += "### Resume / LinkedIn Bullets\n\n";
  for (const bullet of brief.resume_bullets) {
    md += `- **${bullet.audience}**: ${bullet.text}${evidenceList(bullet.evidence_refs)}\n`;
  }
  md += "\n";

  md += "### Candidate Brief Warnings\n\n";
  if (brief.warnings.length === 0) {
    md += "_No Candidate Brief warnings._\n\n";
  } else {
    for (const warning of brief.warnings) {
      md += `- ${warning.message}${evidenceList(warning.evidence_refs ?? [])}\n`;
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
  let md = `# Repo Brief: ${report.repo_metadata.name}\n\n`;
  md += `- **URL**: ${report.repo_metadata.url}\n`;
  md += `- **Branch**: ${report.repo_metadata.branch}\n`;
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
    md += `- \`${cmd.command}\` (from ${cmd.source})${cmd.description ? ` - ${cmd.description}` : ""}\n`;
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
