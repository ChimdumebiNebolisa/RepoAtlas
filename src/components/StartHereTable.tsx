"use client";

import { useState } from "react";
import type { StartHereItem } from "@/types/report";

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
            >
              Score {sortBy === "score" && (asc ? "↑" : "↓")}
            </th>
            <th className="px-4 py-2 text-left">Explanation</th>
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
              <td className="px-4 py-2">{item.score.toFixed(0)}</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                {item.explanation}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
