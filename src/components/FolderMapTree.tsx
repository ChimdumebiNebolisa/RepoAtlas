"use client";

import { useState } from "react";
import type { FolderMapNode } from "@/types/report";

interface FolderMapTreeProps {
  node: FolderMapNode;
  defaultExpandDepth?: number;
}

function TreeNode({
  node,
  depth = 0,
  defaultExpandDepth = 2,
}: {
  node: FolderMapNode;
  depth?: number;
  defaultExpandDepth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < defaultExpandDepth);
  const isDir = node.type === "dir" && node.children && node.children.length > 0;
  const name = node.path.split("/").pop() || node.path;

  return (
    <div className="relative ml-4 border-l border-slate-200 pl-3">
      <div
        className="group flex cursor-pointer items-center gap-2 rounded-md py-1 pr-2 hover:bg-slate-50"
        style={{ paddingLeft: depth * 12 }}
        onClick={() => isDir && setExpanded(!expanded)}
      >
        <span className="absolute -left-[7px] h-2.5 w-2.5 rounded-full bg-slate-200 group-hover:bg-emerald-400" />
        {isDir ? (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-white text-[10px] text-slate-600">
            {expanded ? "-" : "+"}
          </span>
        ) : (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-slate-50 text-[10px] text-slate-500">
            •
          </span>
        )}
        <span
          className={
            node.type === "dir" ? "font-medium text-slate-900" : "text-slate-800"
          }
        >
          {name}
        </span>
        {node.type === "dir" && node.children && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
            {node.children.length}
          </span>
        )}
        {node.type === "file" && depth < 2 && (
          <span className="truncate text-xs text-slate-500">{node.path}</span>
        )}
      </div>
      {isDir && expanded && node.children && (
        <div className="space-y-0.5">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              defaultExpandDepth={defaultExpandDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderMapTree({ node, defaultExpandDepth = 2 }: FolderMapTreeProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 font-mono text-sm">
      <TreeNode node={node} defaultExpandDepth={defaultExpandDepth} />
    </div>
  );
}
