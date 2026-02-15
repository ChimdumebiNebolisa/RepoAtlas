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
    const cmp =
      sortBy === "score"
        ? a.score - b.score
        : a.path.localeCompare(b.path);
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
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
          Suggested reading order for onboarding
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
                className="px-4 py-2 text-left cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => toggleSort("path")}
              >
                Path {sortBy === "path" && (asc ? "↑" : "↓")}
              </th>
              <th
                className="px-4 py-2 text-left cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => toggleSort("score")}
                title="Relative onboarding priority; 100 = top place to start"
              >
                Priority (0–100) {sortBy === "score" && (asc ? "↑" : "↓")}
              </th>
              <th className="px-4 py-2 text-left">Signals</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, i) => (
              <tr key={i} className="border-t dark:border-gray-700">
                <td className="px-4 py-2 font-mono text-sm">
                  <code className="bg-gray-100 text-slate-900 px-1 rounded">
                    {item.path}
                  </code>
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
