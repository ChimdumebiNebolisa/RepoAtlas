import React, { useRef, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InputMode } from "./inputFormSupport";
import { RepositoryInputControls } from "./RepositoryInputControls";

function RepositoryInputHarness({
  loading = false,
  hasFieldError = false,
}: {
  loading?: boolean;
  hasFieldError?: boolean;
}) {
  const [mode, setMode] = useState<InputMode>("github");
  const inputRef = useRef<HTMLInputElement>(null);
  const githubUrlInputRef = useRef<HTMLInputElement>(null);
  const githubRefInputRef = useRef<HTMLInputElement>(null);

  return (
    <RepositoryInputControls
      mode={mode}
      loading={loading}
      file={null}
      githubUrl=""
      githubRef=""
      hasFieldError={hasFieldError}
      inputRef={inputRef}
      githubUrlInputRef={githubUrlInputRef}
      githubRefInputRef={githubRefInputRef}
      onModeChange={setMode}
      onFileChange={vi.fn()}
      onGithubUrlChange={vi.fn()}
      onGithubRefChange={vi.fn()}
    />
  );
}

function repositoryTabs() {
  return {
    github: screen.getByRole("tab", { name: "Public GitHub URL" }),
    zip: screen.getByRole("tab", { name: "Upload ZIP" }),
  };
}

afterEach(cleanup);

describe("RepositoryInputControls", () => {
  it("starts with GitHub as the only repository-input tab stop", () => {
    render(<RepositoryInputHarness />);
    const { github, zip } = repositoryTabs();

    expect(screen.getByRole("tablist", { name: "Repository input method" })).toHaveAttribute(
      "aria-orientation",
      "horizontal"
    );
    expect(github).toHaveAttribute("aria-selected", "true");
    expect(github).toHaveAttribute("tabindex", "0");
    expect(zip).toHaveAttribute("aria-selected", "false");
    expect(zip).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "input-panel-github");
    expect(screen.getByLabelText("Public GitHub repository URL")).toBeInTheDocument();
    expect(screen.queryByLabelText("Choose repository zip file")).not.toBeInTheDocument();
  });

  it("moves selection, focus, and the active panel when a tab is clicked", async () => {
    const user = userEvent.setup();
    render(<RepositoryInputHarness />);

    await user.click(repositoryTabs().zip);
    const { github, zip } = repositoryTabs();

    expect(zip).toHaveFocus();
    expect(zip).toHaveAttribute("aria-selected", "true");
    expect(zip).toHaveAttribute("tabindex", "0");
    expect(github).toHaveAttribute("aria-selected", "false");
    expect(github).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "input-panel-zip");
    expect(screen.getByLabelText("Choose repository zip file")).toBeInTheDocument();
    expect(screen.queryByLabelText("Public GitHub repository URL")).not.toBeInTheDocument();
  });

  it("wraps Arrow keys across both tabs while moving focus and selection", async () => {
    const user = userEvent.setup();
    render(<RepositoryInputHarness />);
    repositoryTabs().github.focus();

    await user.keyboard("{ArrowRight}");
    expect(repositoryTabs().zip).toHaveFocus();
    expect(repositoryTabs().zip).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowRight}");
    expect(repositoryTabs().github).toHaveFocus();
    expect(repositoryTabs().github).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}");
    expect(repositoryTabs().zip).toHaveFocus();
    expect(repositoryTabs().zip).toHaveAttribute("aria-selected", "true");
  });

  it("moves to the first and last tabs with Home and End", async () => {
    const user = userEvent.setup();
    render(<RepositoryInputHarness />);
    repositoryTabs().github.focus();

    await user.keyboard("{End}");
    expect(repositoryTabs().zip).toHaveFocus();
    expect(repositoryTabs().zip).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Home}");
    expect(repositoryTabs().github).toHaveFocus();
    expect(repositoryTabs().github).toHaveAttribute("aria-selected", "true");
  });

  it("keeps disabled tabs and their panels unchanged during loading", () => {
    render(<RepositoryInputHarness loading />);
    const { github, zip } = repositoryTabs();

    expect(github).toBeDisabled();
    expect(zip).toBeDisabled();
    fireEvent.keyDown(github, { key: "End" });
    fireEvent.click(zip);

    expect(github).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "input-panel-github");
    expect(screen.getByLabelText("Public GitHub repository URL")).toBeDisabled();
  });

  it("preserves validation semantics in both repository panels", async () => {
    const user = userEvent.setup();
    render(<RepositoryInputHarness hasFieldError />);

    expect(screen.getByLabelText("Public GitHub repository URL")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(screen.getByLabelText("Branch or tag (optional)")).toHaveAttribute(
      "aria-invalid",
      "true"
    );

    await user.click(repositoryTabs().zip);
    expect(screen.getByLabelText("Choose repository zip file")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(screen.getByLabelText("Choose repository zip file")).toHaveAttribute(
      "aria-describedby",
      "input-form-error"
    );
  });
});
