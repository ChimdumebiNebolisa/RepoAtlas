import type { DocumentInventory } from "@/types/report";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsPanel({ inventory }: { inventory: DocumentInventory }) {
  const { documents, duplicate_groups, similar_groups, canonical_readme } = inventory;

  if (!documents.length) {
    return (
      <p className="text-sm text-slate-600">No documentation files detected in this repository.</p>
    );
  }

  return (
    <div className="space-y-4">
      {canonical_readme && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          <span className="font-medium text-emerald-900">Canonical README: </span>
          <code className="text-emerald-800">{canonical_readme}</code>
        </div>
      )}

      {duplicate_groups.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-900">Duplicate documents</h4>
          <ul className="space-y-2 text-sm text-slate-700">
            {duplicate_groups.map((group) => (
              <li key={group.canonical} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                <p>
                  <span className="font-medium">Canonical:</span>{" "}
                  <code>{group.canonical}</code>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {group.reason === "identical" ? "Identical content" : "Normalized-identical content"}
                </p>
                <ul className="mt-1 list-inside list-disc text-xs">
                  {group.duplicates.map((path) => (
                    <li key={path}>
                      <code>{path}</code>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {similar_groups && similar_groups.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-900">Similar documents</h4>
          <ul className="space-y-2 text-sm text-slate-700">
            {similar_groups.map((group) => (
              <li
                key={group.paths.join("|")}
                className="rounded-md border border-slate-200 bg-white px-3 py-2"
              >
                <p className="text-xs text-slate-500">
                  {Math.round(group.similarity * 100)}% similar
                </p>
                <ul className="mt-1 list-inside list-disc text-xs">
                  {group.paths.map((path) => (
                    <li key={path}>
                      <code>{path}</code>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-900">All documentation files</h4>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Path</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Scope</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <tr key={doc.path} className="text-slate-700">
                  <td className="px-3 py-2">
                    <code className="text-xs">{doc.path}</code>
                  </td>
                  <td className="px-3 py-2 capitalize">{doc.category}</td>
                  <td className="px-3 py-2 capitalize">{doc.scope}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatBytes(doc.bytes)}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {doc.canonical && "canonical"}
                    {doc.duplicate_of && (
                      <span>
                        {doc.canonical ? "; " : ""}
                        duplicate of <code>{doc.duplicate_of}</code>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
