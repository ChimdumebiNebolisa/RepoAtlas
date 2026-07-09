"use client";

import { useState } from "react";
import type { StartHereItem } from "@/types/report";
import { ScoreCircle } from "@/components/ScoreCircle";

interface StartHereTableProps {
  items: StartHereItem[];
}

export function StartHereTable({ items }: StartHereTableProps) {
  const [sortBy, setSortBy] = useState<"path" | "score">("score");
  const [asc, setAsc] = useState(false);

  const sorted = [...items].sort((a, b) => {
    const cmp = sortBy === "score" ? a.score - b.score : a.path.localeCompare(b.path);
    return asc ? cmp : -cmp;
  });

  const toggleSort = (col: "path" | "score") => {
    if (sortBy === col) setAsc(!asc);
    else {
      setSortBy(col);
      setAsc(col === "path");
    }
  };

  if (!items.length) {
    return <p className="text-gray-500">No Start Here items for this repository.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
          Suggested reading order for interview prep
        </p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Use this to decide what to review first before an interview.
        </p>
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
          Priority 0–100; 100 is the top recommendation. Hover a score for details.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border dark:border-gray-700">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th
                className="px-4 py-2 text-left"
                aria-sort={sortBy === "path" ? (asc ? "ascending" : "descending") : "none"}
              >
                <button
                  type="button"
                  onClick={() => toggleSort("path")}
                  className="rounded px-1 py-0.5 font-semibold hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:hover:bg-gray-700"
                >
                  Path {sortBy === "path" && (asc ? "↑" : "↓")}
                </button>
              </th>
              <th
                className="px-4 py-2 text-left"
                aria-sort={sortBy === "score" ? (asc ? "ascending" : "descending") : "none"}
                title="Relative onboarding priority; 100 = top place to start"
              >
                <button
                  type="button"
                  onClick={() => toggleSort("score")}
                  className="rounded px-1 py-0.5 font-semibold hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:hover:bg-gray-700"
                >
                  Priority (0–100) {sortBy === "score" && (asc ? "↑" : "↓")}
                </button>
              </th>
              <th className="px-4 py-2 text-left">Signals</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, i) => (
              <tr key={i} className="border-t dark:border-gray-700">
                <td className="px-4 py-2 font-mono text-sm">
                  <code className="rounded bg-gray-100 px-1 text-slate-900">{item.path}</code>
                </td>
                <td className="px-4 py-2">
                  <ScoreCircle
                    score={item.score}
                    variant="priority"
                    tooltip={`Priority: ${item.score.toFixed(0)} — Relative onboarding priority; 100 = top place to start`}
                  />
                </td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                  {item.explanation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-500">
        Scores are computed from repo structure and imports only; no code execution.
      </p>
    </div>
  );
}
