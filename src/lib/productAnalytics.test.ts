import { describe, expect, it } from "vitest";
import { stableRouteName } from "./productAnalytics";

describe("stableRouteName", () => {
  it("keeps report and share identifiers out of analytics properties", () => {
    expect(stableRouteName("/report/1a2b3c")).toBe("report");
    expect(stableRouteName("/share/secret-token")).toBe("shared_report");
  });

  it("names known static routes without recording arbitrary paths", () => {
    expect(stableRouteName("/")).toBe("home");
    expect(stableRouteName("/pricing")).toBe("pricing");
    expect(stableRouteName("/unexpected/private-value")).toBe("other");
  });
});
