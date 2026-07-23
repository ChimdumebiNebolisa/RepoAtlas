import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { buildSampleReport } from "@/lib/buildSampleReport";
import { REPORT_VERSION } from "@/types/report";
import TokenSharePage from "./page";

const route = vi.hoisted(() => ({
  params: { token: "stored-share-token-1234" } as { token?: string },
}));
const portable = vi.hoisted(() => {
  class MockPortableShareError extends Error {}
  return {
    openPortableShare: vi.fn(),
    PortableShareError: MockPortableShareError,
    token: "portable",
  };
});
const reportTabsProps = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useParams: () => route.params,
}));

vi.mock("@/lib/portableSharing", () => ({
  openPortableShare: portable.openPortableShare,
  PORTABLE_SHARE_TOKEN: portable.token,
  PortableShareError: portable.PortableShareError,
}));

vi.mock("@/components/ReportTabs", () => ({
  ReportTabs: (props: Record<string, unknown>) => {
    reportTabsProps(props);
    return <div data-testid="report-tabs">Read-only Candidate Brief</div>;
  },
}));

const fetchMock = vi.fn();
const expiresAt = "2026-07-30T12:00:00.000Z";

function response({
  ok = true,
  data,
  rejects = false,
}: {
  ok?: boolean;
  data?: unknown;
  rejects?: boolean;
}) {
  return {
    ok,
    json: rejects
      ? vi.fn().mockRejectedValue(new SyntaxError("invalid JSON"))
      : vi.fn().mockResolvedValue(data),
  } as unknown as Response;
}

function storedPayload(report = buildSampleReport()) {
  return {
    report,
    share: {
      expiresAt,
      createdAt: "2026-07-23T12:00:00.000Z",
    },
  };
}

beforeEach(() => {
  route.params = { token: "stored-share-token-1234" };
  fetchMock.mockReset();
  portable.openPortableShare.mockReset();
  reportTabsProps.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/share/stored-share-token-1234");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("shared Candidate Brief loading", () => {
  it("shows a recovery state when the share token is missing", () => {
    route.params = {};

    render(<TokenSharePage />);

    expect(screen.getByRole("alert")).toHaveTextContent("Missing share token.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows loading while a stored share request is pending", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    render(<TokenSharePage />);

    expect(screen.getByText("Loading report…")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  });

  it("renders a validated stored share with its expiry", async () => {
    const report = buildSampleReport();
    fetchMock.mockResolvedValue(response({ data: storedPayload(report) }));

    render(<TokenSharePage />);

    expect(await screen.findByTestId("report-tabs")).toBeInTheDocument();
    expect(
      screen.getByText(
        (text) => text.startsWith("Link expires") && text.includes("2026")
      )
    ).toBeInTheDocument();
    expect(reportTabsProps).toHaveBeenCalledWith({
      report,
      variant: "shared",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/share/${route.params.token}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("shows the API message when a stored share is expired", async () => {
    fetchMock.mockResolvedValue(
      response({
        ok: false,
        data: { message: "Share link expired or not found." },
      })
    );

    render(<TokenSharePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Share link expired or not found."
    );
    expect(reportTabsProps).not.toHaveBeenCalled();
  });

  it("uses a bounded message for a malformed API error", async () => {
    fetchMock.mockResolvedValue(
      response({ ok: false, data: { message: null } })
    );

    render(<TokenSharePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Share link expired or not found."
    );
  });

  it("rejects non-JSON success responses before rendering", async () => {
    fetchMock.mockResolvedValue(response({ rejects: true }));

    render(<TokenSharePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This shared report could not be opened because its data is incomplete or invalid."
    );
    expect(reportTabsProps).not.toHaveBeenCalled();
  });

  it("rejects incomplete reports before rendering", async () => {
    fetchMock.mockResolvedValue(
      response({ data: storedPayload({} as ReturnType<typeof buildSampleReport>) })
    );

    render(<TokenSharePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This shared report could not be opened because its data is incomplete or invalid."
    );
    expect(reportTabsProps).not.toHaveBeenCalled();
  });

  it.each([
    { share: null },
    { share: { expiresAt: "not-a-date" } },
  ])("rejects invalid share metadata: %o", async (share) => {
    fetchMock.mockResolvedValue(
      response({ data: { report: buildSampleReport(), ...share } })
    );

    render(<TokenSharePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This shared report could not be opened because its data is incomplete or invalid."
    );
    expect(reportTabsProps).not.toHaveBeenCalled();
  });

  it("explains when a stored report uses an unsupported schema", async () => {
    fetchMock.mockResolvedValue(
      response({
        data: storedPayload({
          ...buildSampleReport(),
          report_version: REPORT_VERSION + 1,
        }),
      })
    );

    render(<TokenSharePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This shared report was created by an unsupported RepoAtlas version."
    );
  });

  it("recovers from a request failure and retries the stored share", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockRejectedValueOnce(new TypeError("private network detail"))
      .mockResolvedValueOnce(response({ data: storedPayload() }));

    render(<TokenSharePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to load shared report."
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByTestId("report-tabs")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("opens a portable share from the browser fragment", async () => {
    const report = buildSampleReport();
    route.params = { token: portable.token };
    window.history.replaceState(null, "", "/share/portable#v1.private-link");
    portable.openPortableShare.mockResolvedValue({
      report,
      createdAt: "2026-07-23T12:00:00.000Z",
      expiresAt,
    });

    render(<TokenSharePage />);

    expect(await screen.findByTestId("report-tabs")).toBeInTheDocument();
    expect(portable.openPortableShare).toHaveBeenCalledWith("#v1.private-link");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reportTabsProps).toHaveBeenCalledWith({
      report,
      variant: "shared",
    });
  });

  it("preserves a portable-share recovery message", async () => {
    route.params = { token: portable.token };
    portable.openPortableShare.mockRejectedValue(
      new portable.PortableShareError("This private share link has expired.")
    );

    render(<TokenSharePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This private share link has expired."
    );
  });

  it("uses a bounded recovery for an unexpected portable failure", async () => {
    route.params = { token: portable.token };
    portable.openPortableShare.mockRejectedValue(new Error("crypto detail"));

    render(<TokenSharePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to load shared report."
    );
  });

  it("aborts a stored request when the page unmounts", async () => {
    let requestSignal: AbortSignal | undefined;
    fetchMock.mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          requestSignal = init?.signal ?? undefined;
          requestSignal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        })
    );

    const view = render(<TokenSharePage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    view.unmount();

    expect(requestSignal?.aborted).toBe(true);
  });

  it("ignores a portable result that resolves after unmount", async () => {
    route.params = { token: portable.token };
    let resolvePortable:
      | ((value: {
          report: ReturnType<typeof buildSampleReport>;
          createdAt: string;
          expiresAt: string;
        }) => void)
      | undefined;
    portable.openPortableShare.mockReturnValue(
      new Promise((resolve) => {
        resolvePortable = resolve;
      })
    );

    const view = render(<TokenSharePage />);
    await waitFor(() => expect(portable.openPortableShare).toHaveBeenCalledOnce());
    view.unmount();
    resolvePortable?.({
      report: buildSampleReport(),
      createdAt: "2026-07-23T12:00:00.000Z",
      expiresAt,
    });
    await Promise.resolve();

    expect(reportTabsProps).not.toHaveBeenCalled();
  });
});
