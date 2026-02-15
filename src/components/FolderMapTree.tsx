"use client";

import { useState } from "react";
import type { FolderMapNode } from "@/types/report";

interface FolderMapTreeProps {
  node: FolderMapNode;
}

function TreeNode({ node, depth = 0 }: { node: FolderMapNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isDir = node.type === "dir" && node.children && node.children.length > 0;
  const name = node.path.split("/").pop() || node.path;

  return (
    <div className="ml-4">
      <div
        className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
        style={{ paddingLeft: depth * 12 }}
        onClick={() => isDir && setExpanded(!expanded)}
      >
        {isDir ? (
          <span className="w-4">{expanded ? "▼" : "▶"}</span>
        ) : (
          <span className="w-4" />
        )}
        <span className={node.type === "dir" ? "font-medium" : ""}>
          {name}
        </span>
        {node.type === "file" && (
          <span className="text-gray-500 text-sm">{node.path}</span>
        )}
      </div>
      {isDir && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderMapTree({ node }: FolderMapTreeProps) {
  return (
    <div className="font-mono text-sm">
      <TreeNode node={node} />
    </div>
  );
}
