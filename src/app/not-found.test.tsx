import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import NotFound, { metadata } from "@/app/not-found";

afterEach(cleanup);

describe("not-found recovery", () => {
  it("keeps the 404 state specific to RepoAtlas with one homepage recovery action", () => {
    render(<NotFound />);

    const main = screen.getByRole("main");
    expect(within(main).getByText("404 / Page not found")).toBeInTheDocument();
    expect(
      within(main).getByRole("heading", {
        level: 1,
        name: "We couldn't find this page.",
      }),
    ).toBeInTheDocument();
    expect(
      within(main).getByText(/link may be incomplete or out of date/i),
    ).toBeInTheDocument();
    expect(
      within(main).getByRole("link", { name: "Return to RepoAtlas" }),
    ).toHaveAttribute("href", "/");
    expect(within(main).getAllByRole("link", { name: /RepoAtlas/i })).toHaveLength(2);
    expect(main).not.toHaveTextContent(/pricing/i);
  });

  it("keeps the route metadata explicit", () => {
    expect(metadata.title).toBe("Page not found | RepoAtlas");
  });
});
