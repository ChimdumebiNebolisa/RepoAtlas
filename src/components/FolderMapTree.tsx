"use client";

import { useId, useState } from "react";
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
  const controlId = useId();
  const childGroupId = `${controlId}-children`;
  const isDirectory = node.type === "dir";
  const isExpandable = isDirectory && Boolean(node.children?.length);
  const name = node.path.split("/").pop() || node.path;
  const accessibleName = node.path === "." ? "Repository root" : name;
  const rowContent = (
    <>
      <span
        aria-hidden="true"
        className="absolute -left-[7px] h-2.5 w-2.5 rounded-full bg-slate-200 group-hover:bg-emerald-400"
      />
      {isExpandable ? (
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-white text-[10px] text-slate-600"
        >
          {expanded ? "-" : "+"}
        </span>
      ) : isDirectory ? (
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-white text-[10px] text-slate-600"
        >
          {node.truncated ? "…" : "/"}
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-slate-50 text-[10px] text-slate-500"
        >
          •
        </span>
      )}
      <span className={node.type === "dir" ? "font-medium text-slate-900" : "text-slate-800"}>
        {name}
      </span>
      {isDirectory && node.children && !node.truncated && (
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
          {node.children.length}
        </span>
      )}
      {node.truncated && (
        <span
          data-folder-map-state="truncated"
          className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800"
        >
          RepoAtlas stopped mapping at this depth.
        </span>
      )}
      {node.type === "file" && depth < 2 && (
        <span className="truncate text-xs text-slate-500">{node.path}</span>
      )}
    </>
  );

  return (
    <li className="relative ml-4 list-none border-l border-slate-200 pl-3">
      {isExpandable ? (
        <button
          id={controlId}
          type="button"
          className="group flex w-full items-center gap-2 rounded-md py-1 pr-2 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          style={{ paddingLeft: depth * 12 }}
          aria-label={`${accessibleName}, ${node.children!.length} ${
            node.children!.length === 1 ? "item" : "items"
          }`}
          aria-expanded={expanded}
          aria-controls={childGroupId}
          onClick={() => setExpanded(!expanded)}
        >
          {rowContent}
        </button>
      ) : (
        <div
          className="group flex items-center gap-2 rounded-md py-1 pr-2"
          style={{ paddingLeft: depth * 12 }}
        >
          {rowContent}
        </div>
      )}
      {isExpandable && node.children && (
        <ul
          id={childGroupId}
          aria-labelledby={controlId}
          className="m-0 list-none space-y-0.5 p-0"
          hidden={!expanded}
        >
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              defaultExpandDepth={defaultExpandDepth}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function FolderMapTree({ node, defaultExpandDepth = 2 }: FolderMapTreeProps) {
  return (
    <ul
      aria-label="Repository folder hierarchy"
      className="m-0 list-none rounded-xl border border-slate-200 bg-white p-3 font-mono text-sm"
    >
      <TreeNode node={node} defaultExpandDepth={defaultExpandDepth} />
    </ul>
  );
}
