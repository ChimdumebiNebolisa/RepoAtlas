export const REPORT_CAPABILITY_RULES = {
  alwaysAvailableExports: ["PDF", "PNG"],
  portableSharing: "7-day encrypted browser sharing",
  storageDependent: ["Markdown", "saved server links"],
} as const;

const exportPair = REPORT_CAPABILITY_RULES.alwaysAvailableExports.join(" and ");
const storageDependentPair = REPORT_CAPABILITY_RULES.storageDependent.join(" and ");

export const reportCapabilityCopy = {
  headerBadge: "PDF/PNG + encrypted sharing",
  homepagePipelineSummary: "PDF, PNG, encrypted link",
  homepageStorageNote: `${exportPair} exports and ${REPORT_CAPABILITY_RULES.portableSharing} work with completed reports. ${storageDependentPair} require saved report storage.`,
  inlineReport: `Generated report ready for ${exportPair} export and ${REPORT_CAPABILITY_RULES.portableSharing}. ${storageDependentPair} require saved report storage, which is currently unavailable.`,
  previewReport: `Read-only sample. ${exportPair} are available here; Markdown requires a saved analysis.`,
} as const;
