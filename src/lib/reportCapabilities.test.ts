import { describe, expect, it } from "vitest";
import { REPORT_CAPABILITY_RULES, reportCapabilityCopy } from "./reportCapabilities";

describe("report capability copy", () => {
  it("keeps always-available homepage capabilities separate from storage-dependent ones", () => {
    for (const format of REPORT_CAPABILITY_RULES.alwaysAvailableExports) {
      expect(reportCapabilityCopy.headerBadge).toContain(format);
      expect(reportCapabilityCopy.homepageBriefExports).toContain(format);
      expect(reportCapabilityCopy.homepagePipelineSummary).toContain(format);
      expect(reportCapabilityCopy.homepageStorageNote).toContain(format);
    }

    expect(reportCapabilityCopy.homepageStorageNote).toContain(
      REPORT_CAPABILITY_RULES.portableSharing
    );

    for (const capability of REPORT_CAPABILITY_RULES.storageDependent) {
      expect(reportCapabilityCopy.headerBadge).not.toContain(capability);
      expect(reportCapabilityCopy.homepageBriefExports).not.toContain(capability);
      expect(reportCapabilityCopy.homepagePipelineSummary).not.toContain(capability);
      expect(reportCapabilityCopy.homepageStorageNote).toContain(capability);
    }
  });

  it("keeps the homepage and inline report aligned on the saved-storage boundary", () => {
    expect(reportCapabilityCopy.homepageStorageNote).toContain("saved report storage");
    expect(reportCapabilityCopy.inlineReport).toContain("saved report storage");
    expect(reportCapabilityCopy.inlineReport).toContain("PDF and PNG export");
    expect(reportCapabilityCopy.inlineReport).toContain(
      REPORT_CAPABILITY_RULES.portableSharing
    );
    for (const capability of REPORT_CAPABILITY_RULES.storageDependent) {
      expect(reportCapabilityCopy.inlineReport).toContain(capability);
    }
    expect(reportCapabilityCopy.inlineReport).toContain("currently unavailable");
  });
});
