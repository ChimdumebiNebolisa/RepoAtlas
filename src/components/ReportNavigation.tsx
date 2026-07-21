"use client";

import { useRef, type KeyboardEvent } from "react";

export const REPORT_TABS = [
  "Candidate Brief",
  "Overview",
  "Folder Map",
  "Architecture Map",
  "Start Here",
  "Danger Zones",
  "Run & Contribute",
  "Export",
] as const;

export type ReportTab = (typeof REPORT_TABS)[number];

export function reportTabKey(tab: ReportTab) {
  return tab.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function ReportNavigation({
  activeTab,
  onChange,
  tabsId,
}: {
  activeTab: ReportTab;
  onChange: (tab: ReportTab) => void;
  tabsId: string;
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activateTab = (index: number) => {
    const nextTab = REPORT_TABS[index];
    const nextControl = tabRefs.current[index];
    onChange(nextTab);
    nextControl?.focus();
    nextControl?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % REPORT_TABS.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + REPORT_TABS.length) % REPORT_TABS.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = REPORT_TABS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    activateTab(nextIndex);
  };

  return (
    <div className="report-tab-rail">
      <nav
        className="report-tab-list"
        aria-label="Report sections"
        aria-orientation="horizontal"
        role="tablist"
      >
        {REPORT_TABS.map((tab, index) => {
          const tabKey = reportTabKey(tab);
          return (
            <button
              key={tab}
              id={`${tabsId}-tab-${tabKey}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`${tabsId}-panel-${tabKey}`}
              tabIndex={activeTab === tab ? 0 : -1}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              onClick={() => onChange(tab)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className="report-tab"
            >
              {tab}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
