import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots metadata route", () => {
  it("permits public crawling and names the production sitemap", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
      },
      sitemap: "https://repo-atlas-phi.vercel.app/sitemap.xml",
    });
  });
});
