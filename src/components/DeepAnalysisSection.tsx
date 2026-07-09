import type {
  ArchitectureInsights,
  CommitInsights,
  ProjectProfile,
  TestInventory,
} from "@/types/report";

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 text-sm text-slate-700">{children}</div>
    </section>
  );
}

export function DeepAnalysisSection({
  projectProfile,
  testInventory,
  architectureInsights,
  commitInsights,
}: {
  projectProfile?: ProjectProfile;
  testInventory?: TestInventory;
  architectureInsights?: ArchitectureInsights;
  commitInsights?: CommitInsights;
}) {
  const hasContent =
    projectProfile ||
    testInventory ||
    architectureInsights ||
    (commitInsights && commitInsights.mode !== "unavailable");

  if (!hasContent) {
    return (
      <p className="text-sm text-slate-600">
        Deep analysis signals appear here when the repository has enough structure, tests, or git
        metadata.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {projectProfile && (
        <Panel title="Project profile">
          <p className="font-medium text-slate-900">{projectProfile.label}</p>
          <p className="mt-1 text-xs text-slate-500">
            Type: {projectProfile.type} · {projectProfile.confidence} confidence
          </p>
          {projectProfile.signals.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {projectProfile.signals.map((s) => (
                <li key={s}>
                  <code className="text-xs">{s}</code>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {testInventory && (
        <Panel title="Test inventory">
          <p>
            <span className="font-medium">{testInventory.test_file_count}</span> test file(s)
            {testInventory.frameworks.length > 0 && (
              <> · {testInventory.frameworks.join(", ")}</>
            )}
          </p>
          {testInventory.untested_high_risk_files.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-amber-800">High-risk files without nearby tests</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {testInventory.untested_high_risk_files.slice(0, 5).map((f) => (
                  <li key={f}>
                    <code>{f}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {testInventory.suggested_test_targets.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-slate-800">Suggested test targets</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {testInventory.suggested_test_targets.slice(0, 4).map((f) => (
                  <li key={f}>
                    <code>{f}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      )}

      {architectureInsights && (
        <Panel title="Architecture boundaries">
          {architectureInsights.layers.length > 0 && (
            <p className="text-xs">Layers: {architectureInsights.layers.join(" → ")}</p>
          )}
          {architectureInsights.hubs.length > 0 && (
            <p className="mt-2 text-xs">
              Hubs: {architectureInsights.hubs.slice(0, 5).map((h) => `\`${h}\``).join(", ")}
            </p>
          )}
          {architectureInsights.violations.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-amber-800">
              {architectureInsights.violations.slice(0, 4).map((v) => (
                <li key={`${v.from}-${v.to}`}>
                  {v.from} → {v.to}: {v.reason}
                </li>
              ))}
            </ul>
          )}
          {architectureInsights.circular_deps.length > 0 && (
            <p className="mt-2 text-xs text-amber-800">
              {architectureInsights.circular_deps.length} circular dependency chain(s) detected
            </p>
          )}
        </Panel>
      )}

      {commitInsights && commitInsights.mode !== "unavailable" && (
        <Panel title="Commit insights">
          <p className="text-xs text-slate-500">Source: {commitInsights.mode.replace("_", " ")}</p>
          {commitInsights.recent_work_areas.length > 0 && (
            <p className="mt-2">
              Recent areas: {commitInsights.recent_work_areas.join(", ")}
            </p>
          )}
          {commitInsights.high_churn_files.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {commitInsights.high_churn_files.map((f) => (
                <li key={f}>
                  <code>{f}</code>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
