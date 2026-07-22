// @vitest-environment node

import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InputForm } from "./InputForm";

const noop = () => undefined;

describe("InputForm server rendering", () => {
  it("keeps repository controls disabled until hydration owns their state", () => {
    const html = renderToString(
      <InputForm
        onAnalyzeStart={noop}
        onAnalyzeComplete={noop}
        onAnalyzeError={noop}
        loading={false}
      />
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(/id="githubUrl"[^>]*disabled=""/);
    expect(html).toMatch(/Analyze public GitHub repository<\/span><\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*><span aria-live="polite">Analyze public GitHub repository/);
  });
});
