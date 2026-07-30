import { useRef, type ChangeEvent, type KeyboardEvent, type RefObject } from "react";
import type { InputMode } from "./inputFormSupport";

interface RepositoryInputControlsProps {
  mode: InputMode;
  loading: boolean;
  file: File | null;
  githubUrl: string;
  githubRef: string;
  hasFieldError: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  githubUrlInputRef: RefObject<HTMLInputElement | null>;
  githubRefInputRef: RefObject<HTMLInputElement | null>;
  onModeChange: (mode: InputMode) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onGithubUrlChange: (value: string) => void;
  onGithubRefChange: (value: string) => void;
}

export function RepositoryInputControls({
  mode,
  loading,
  file,
  githubUrl,
  githubRef,
  hasFieldError,
  inputRef,
  githubUrlInputRef,
  githubRefInputRef,
  onModeChange,
  onFileChange,
  onGithubUrlChange,
  onGithubRefChange,
}: RepositoryInputControlsProps) {
  const githubTabRef = useRef<HTMLButtonElement>(null);
  const zipTabRef = useRef<HTMLButtonElement>(null);

  const activateMode = (nextMode: InputMode) => {
    if (loading) return;
    onModeChange(nextMode);
    (nextMode === "github" ? githubTabRef : zipTabRef).current?.focus();
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentMode: InputMode
  ) => {
    let nextMode: InputMode | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      nextMode = currentMode === "github" ? "zip" : "github";
    }
    if (event.key === "Home") nextMode = "github";
    if (event.key === "End") nextMode = "zip";
    if (nextMode === null) return;
    event.preventDefault();
    activateMode(nextMode);
  };

  return (
    <>
      <div
        role="tablist"
        aria-label="Repository input method"
        aria-orientation="horizontal"
        className="input-mode-toggle"
      >
        <button
          ref={githubTabRef}
          type="button"
          role="tab"
          id="input-mode-github"
          aria-selected={mode === "github"}
          aria-controls="input-panel-github"
          tabIndex={mode === "github" ? 0 : -1}
          className={mode === "github" ? "input-mode-tab is-active" : "input-mode-tab"}
          onClick={() => activateMode("github")}
          onKeyDown={(event) => handleTabKeyDown(event, "github")}
          disabled={loading}
        >
          Public GitHub URL
        </button>
        <button
          ref={zipTabRef}
          type="button"
          role="tab"
          id="input-mode-zip"
          aria-selected={mode === "zip"}
          aria-controls="input-panel-zip"
          tabIndex={mode === "zip" ? 0 : -1}
          className={mode === "zip" ? "input-mode-tab is-active" : "input-mode-tab"}
          onClick={() => activateMode("zip")}
          onKeyDown={(event) => handleTabKeyDown(event, "zip")}
          disabled={loading}
        >
          Upload ZIP
        </button>
      </div>

      {mode === "zip" ? (
        <div id="input-panel-zip" role="tabpanel" aria-labelledby="input-mode-zip">
          <label htmlFor="zipFile" className="input-label">
            Repository zip file
          </label>
          <div className="file-picker">
            <input
              ref={inputRef}
              id="zipFile"
              type="file"
              accept=".zip"
              onChange={onFileChange}
              className="absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
              disabled={loading}
              aria-label="Choose repository zip file"
              aria-invalid={hasFieldError}
              aria-describedby={hasFieldError ? "input-form-error" : undefined}
            />
            <span className="file-name">{file ? file.name : "No file chosen"}</span>
            <span className="file-action">Choose file</span>
          </div>
        </div>
      ) : (
        <div id="input-panel-github" role="tabpanel" aria-labelledby="input-mode-github">
          <label htmlFor="githubUrl" className="input-label">
            Public GitHub repository URL
          </label>
          <input
            ref={githubUrlInputRef}
            id="githubUrl"
            type="url"
            inputMode="url"
            placeholder="https://github.com/owner/repository"
            value={githubUrl}
            onChange={(event) => onGithubUrlChange(event.target.value)}
            className="text-input"
            disabled={loading}
            autoComplete="off"
            aria-describedby="githubUrl-help"
            aria-invalid={hasFieldError}
          />
          <p id="githubUrl-help" className="input-help">
            Canonical HTTPS github.com URLs only. Public repositories only. Private
            repositories are never accessed.
          </p>
          <label htmlFor="githubRef" className="input-label">
            Branch or tag (optional)
          </label>
          <input
            ref={githubRefInputRef}
            id="githubRef"
            type="text"
            placeholder="Defaults to the repository default branch"
            value={githubRef}
            onChange={(event) => onGithubRefChange(event.target.value)}
            className="text-input"
            disabled={loading}
            autoComplete="off"
            aria-invalid={hasFieldError}
          />
        </div>
      )}
    </>
  );
}
