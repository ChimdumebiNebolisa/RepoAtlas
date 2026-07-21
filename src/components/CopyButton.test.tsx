import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyButton } from "./CopyButton";

const WALKTHROUGH = "Start at src/app/page.tsx, then follow the report data into the analyzer.";

function setClipboard(writeText: (text: string) => Promise<void>) {
  vi.stubGlobal("navigator", { clipboard: { writeText } });
}

function setExecCommand(copy: () => boolean) {
  const execCommand = vi.fn(copy);
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: execCommand,
  });
  return execCommand;
}

describe("CopyButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("reports success after the Clipboard API copies the exact text", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);

    render(<CopyButton text={WALKTHROUGH} label="Copy 30s" />);
    await user.click(screen.getByRole("button", { name: "Copy 30s" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(WALKTHROUGH));
    expect(screen.getByRole("button", { name: /Copied/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Copied to clipboard.");
  });

  it("announces confirmed copy success to the caller", async () => {
    const user = userEvent.setup();
    const onCopySuccess = vi.fn();
    setClipboard(vi.fn().mockResolvedValue(undefined));

    render(
      <CopyButton
        text={WALKTHROUGH}
        label="Copy 30s"
        onCopySuccess={onCopySuccess}
      />
    );
    await user.click(screen.getByRole("button", { name: "Copy 30s" }));

    await waitFor(() => expect(onCopySuccess).toHaveBeenCalledTimes(1));
  });

  it("reports success only when the browser fallback confirms the exact text was copied", async () => {
    const user = userEvent.setup();
    setClipboard(vi.fn().mockRejectedValue(new Error("Clipboard permission denied")));
    let fallbackText = "";
    const execCommand = setExecCommand(() => {
      fallbackText = document.querySelector("textarea")?.value ?? "";
      return true;
    });

    render(<CopyButton text={WALKTHROUGH} label="Copy 2min" />);
    await user.click(screen.getByRole("button", { name: "Copy 2min" }));

    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
    expect(fallbackText).toBe(WALKTHROUGH);
    expect(screen.getByRole("button", { name: /Copied/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Copied to clipboard.");
    expect(document.querySelector("textarea")).not.toBeInTheDocument();
  });

  it("reports failure when neither copy path confirms success", async () => {
    const user = userEvent.setup();
    const onCopySuccess = vi.fn();
    setClipboard(vi.fn().mockRejectedValue(new Error("Clipboard permission denied")));
    setExecCommand(() => false);

    render(
      <CopyButton
        text={WALKTHROUGH}
        label="Copy 30s"
        onCopySuccess={onCopySuccess}
      />
    );
    await user.click(screen.getByRole("button", { name: "Copy 30s" }));

    expect(screen.getByRole("button", { name: /Copy failed/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Copy failed. Copy the text manually."
    );
    expect(onCopySuccess).not.toHaveBeenCalled();
  });
});
