"use client";

import type { RunCommand, ContributeSignals } from "@/types/report";

interface RunContributeSectionProps {
  runCommands: RunCommand[];
  contributeSignals: ContributeSignals;
}

export function RunContributeSection({
  runCommands,
  contributeSignals,
}: RunContributeSectionProps) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold mb-4">Run commands</h2>
        {runCommands.length === 0 ? (
          <p className="text-gray-500">No run commands detected.</p>
        ) : (
          <ul className="space-y-2">
            {runCommands.map((cmd, i) => (
              <li key={i} className="flex items-start gap-2">
                <code className="bg-gray-100 text-slate-900 px-2 py-1 rounded font-mono">
                  {cmd.command}
                </code>
                <span className="text-gray-500 text-sm">
                  (from {cmd.source})
                  {cmd.description && ` — ${cmd.description}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Contribute signals</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-medium mb-2">Key docs</h3>
            {contributeSignals.key_docs.length === 0 ? (
              <p className="text-gray-500 text-sm">None found</p>
            ) : (
              <ul className="list-disc list-inside text-sm">
                {contributeSignals.key_docs.map((doc) => (
                  <li key={doc}>{doc}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="font-medium mb-2">CI configs</h3>
            {contributeSignals.ci_configs.length === 0 ? (
              <p className="text-gray-500 text-sm">None found</p>
            ) : (
              <ul className="list-disc list-inside text-sm">
                {contributeSignals.ci_configs.map((ci) => (
                  <li key={ci}>{ci}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
