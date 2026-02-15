# RepoAtlas Demo Script (2 Minutes)

## Prerequisites

- `npm run dev` running (http://localhost:3000)
- Or a deployed instance

## Demo Flow

### 0:00–0:15 – Input

1. Open RepoAtlas in browser.
2. Paste a GitHub URL, e.g. `https://github.com/vercel/next.js` (or a smaller repo like `https://github.com/sindresorhus/is-odd`).
3. Click **Analyze**.

### 0:15–0:45 – Analysis

1. Show the loading state ("Analyzing...").
2. Wait for analysis to complete (may take 30–60 seconds for larger repos).

### 0:45–1:30 – Report Tabs

1. **Overview**: Metadata, URL, branch, run commands.
2. **Folder Map**: Expand/collapse directory tree.
3. **Architecture Map**: Mermaid dependency graph.
4. **Start Here**: Prioritized reading list with scores.
5. **Danger Zones**: Risk-ranked files with breakdowns.
6. **Run & Contribute**: Commands and docs/CI signals.

### 1:30–2:00 – Export

1. Click **Export Markdown**.
2. Download and open `repo-brief-{id}.md`.
3. Show the Markdown structure: folder map, architecture, Start Here table, Danger Zones, Run & Contribute.

## Acceptance Checklist

- [ ] Input accepts valid GitHub URL.
- [ ] Analysis completes within ~2 minutes.
- [ ] All 6 tabs render non-empty content (for repos with data).
- [ ] Architecture graph renders as Mermaid flowchart.
- [ ] Export Markdown downloads and contains expected sections.
