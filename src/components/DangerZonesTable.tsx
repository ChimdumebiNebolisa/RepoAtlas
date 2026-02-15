"use client";

import { useState } from "react";
import type { DangerZoneItem } from "@/types/report";
import { ScoreCircle } from "@/components/ScoreCircle";

interface DangerZonesTableProps {
  items: DangerZoneItem[];
}

export function DangerZonesTable({ items }: DangerZonesTableProps) {
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
    return <p className="text-gray-500">No Danger Zones for this repository.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
          Files that may need extra attention
        </p>
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
          Risk 0–100 from size, coupling, complexity, and test proximity. Hover a score for details.
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
                className="whitespace-nowrap px-4 py-2 text-left cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => toggleSort("score")}
                title="Combined risk from size, coupling, complexity, and test coverage; higher = more risk"
              >
                Risk (0–100) {sortBy === "score" && (asc ? "↑" : "↓")}
              </th>
              <th className="px-4 py-2 text-left">Breakdown</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, i) => (
              <tr key={i} className="border-t dark:border-gray-700">
                <td className="px-4 py-2 font-mono text-sm">
                  <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                    {item.path}
                  </code>
                </td>
                <td className="px-4 py-2">
                  <ScoreCircle
                    score={item.score}
                    variant="risk"
                    tooltip={`Risk: ${item.score.toFixed(0)} — Combined risk from size, coupling, complexity, and test coverage; higher = more risk`}
                  />
                </td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                  {item.breakdown}
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
