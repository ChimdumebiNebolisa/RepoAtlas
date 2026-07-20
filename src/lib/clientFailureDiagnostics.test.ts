import { describe, expect, it } from "vitest";
import { clientFailureDiagnostic } from "./clientFailureDiagnostics";

describe("client failure diagnostics", () => {
  it("allows only a bounded report-load code and HTTP status", () => {
    const payload = clientFailureDiagnostic("report_load", "REPO_NOT_FOUND", 404);

    expect(payload).toEqual({
      stage: "report_load",
      errorCode: "REPO_NOT_FOUND",
      status: 404,
    });
  });

  it("replaces uncontrolled server values with a safe code", () => {
    const privateCode =
      "private-report-token https://github.com/private-owner/private-repository raw-message";
    const payload = clientFailureDiagnostic("report_load", privateCode, 612);

    expect(payload).toEqual({
      stage: "report_load",
      errorCode: "ANALYSIS_FAILED",
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /private-report-token|private-owner|private-repository|raw-message/
    );
  });

  it("represents unexpected network failures without accepting the raw error", () => {
    expect(clientFailureDiagnostic("network")).toEqual({
      stage: "network",
      errorCode: "NETWORK_ERROR",
    });
  });
});
