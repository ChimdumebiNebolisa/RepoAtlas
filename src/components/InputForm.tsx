"use client";

import { useState, useRef, type RefObject } from "react";
import type { Report } from "@/types/report";
import { ERROR_CODES } from "@/lib/errors";
import { parseGithubRepoUrl, isValidGitRef } from "@/lib/github";

const FALLBACK_ANALYSIS_MESSAGE = "Analysis failed. Check server logs.";

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type InputMode = "zip" | "github";

interface InputFormProps {
  onAnalyzeStart: () => void;
  onAnalyzeComplete: (report: Report, reportId: string) => void;
  onAnalyzeError: (message: string) => void;
  loading: boolean;
  sampleButtonRef?: RefObject<HTMLButtonElement>;
}

interface ApiErrorLike {
  code?: string;
  message?: string;
}

export function formatApiError(payload: ApiErrorLike | null | undefined, fallback: string) {
  if (!payload) return fallback;
  if (payload.code && payload.message) return `${payload.code}: ${payload.message}`;
  return payload.message || payload.code || fallback;
}

export function formatReportFetchError(
  payload: ApiErrorLike | null | undefined,
  status: number,
  reportId: string
) {
  const base = formatApiError(payload, FALLBACK_ANALYSIS_MESSAGE);
  return `Failed to load analysis report (${reportId}, HTTP ${status}). ${base}`;
}

/** Client-side validation mirroring the server's canonical URL rules. */
export function validateGithubInput(url: string, ref: string): string | null {
  if (!url.trim()) return "Enter a public GitHub repository URL.";
  if (!parseGithubRepoUrl(url)) {
    return "Enter a canonical URL like https://github.com/owner/repository.";
  }
  if (ref.trim() && !isValidGitRef(ref)) {
    return "Enter a valid branch or tag name (letters, numbers, ., _, -, /).";
  }
  return null;
}

export function isValidReportId(id: unknown): id is string {
  return typeof id === "string" && UUID_LIKE.test(id.trim());
}

export function InputForm({
  onAnalyzeStart,
  onAnalyzeComplete,
  onAnalyzeError,
  loading,
  sampleButtonRef,
}: InputFormProps) {
  const [mode, setMode] = useState<InputMode>("zip");
  const [file, setFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [githubRef, setGithubRef] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Runs the analyze request and validates the reportId in every flow.
  const runAnalysis = async (init: RequestInit) => {
    try {
      const res = await fetch("/api/analyze", init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onAnalyzeError(formatApiError(data, FALLBACK_ANALYSIS_MESSAGE));
        return;
      }
      const { reportId } = data as { reportId?: unknown };
      if (!isValidReportId(reportId)) {
        onAnalyzeError("Invalid response: missing or malformed reportId.");
        return;
      }

      const reportRes = await fetch(`/api/reports/${reportId}`);
      const reportPayload = await reportRes.json().catch(() => ({}));
      if (!reportRes.ok) {
        console.error("Failed to fetch analyzed report", {
          reportId,
          status: reportRes.status,
          code: reportPayload.code ?? ERROR_CODES.ANALYSIS_FAILED,
          message: reportPayload.message ?? FALLBACK_ANALYSIS_MESSAGE,
        });
        onAnalyzeError(formatReportFetchError(reportPayload, reportRes.status, reportId));
        return;
      }
      onAnalyzeComplete(reportPayload as Report, reportId);
    } catch (error) {
      console.error("Unexpected error during analysis submission", error);
      onAnalyzeError("Network error. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setFieldError(null);

    if (mode === "zip") {
      if (!file) {
        setFieldError("Choose a .zip file to analyze.");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      onAnalyzeStart();
      await runAnalysis({ method: "POST", body: formData });
      return;
    }

    const validationError = validateGithubInput(githubUrl, githubRef);
    if (validationError) {
      setFieldError(validationError);
      return;
    }
    onAnalyzeStart();
    await runAnalysis({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        githubUrl: githubUrl.trim(),
        ...(githubRef.trim() ? { ref: githubRef.trim() } : {}),
      }),
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFieldError(null);
    const chosen = e.target.files?.[0];
    if (!chosen) {
      setFile(null);
      return;
    }
    if (!chosen.name.toLowerCase().endsWith(".zip")) {
      setFieldError("Please select a .zip file.");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(chosen);
  };

  const handleSample = async () => {
    if (loading) return;
    setFieldError(null);
    onAnalyzeStart();
    await runAnalysis({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sample: true }),
    });
  };

  const switchMode = (next: InputMode) => {
    if (loading) return;
    setMode(next);
    setFieldError(null);
  };

  return (
    <form onSubmit={handleSubmit} className="input-form" aria-busy={loading}>
      <div
        role="tablist"
        aria-label="Repository input method"
        className="input-mode-toggle"
      >
        <button
          type="button"
          role="tab"
          id="input-mode-zip"
          aria-selected={mode === "zip"}
          aria-controls="input-panel-zip"
          className={mode === "zip" ? "input-mode-tab is-active" : "input-mode-tab"}
          onClick={() => switchMode("zip")}
          disabled={loading}
        >
          Upload ZIP
        </button>
        <button
          type="button"
          role="tab"
          id="input-mode-github"
          aria-selected={mode === "github"}
          aria-controls="input-panel-github"
          className={mode === "github" ? "input-mode-tab is-active" : "input-mode-tab"}
          onClick={() => switchMode("github")}
          disabled={loading}
        >
          Public GitHub URL
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
              onChange={handleFileChange}
              className="absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
              disabled={loading}
              aria-label="Choose repository zip file"
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
            id="githubUrl"
            type="url"
            inputMode="url"
            placeholder="https://github.com/owner/repository"
            value={githubUrl}
            onChange={(e) => {
              setGithubUrl(e.target.value);
              setFieldError(null);
            }}
            className="text-input"
            disabled={loading}
            autoComplete="off"
            aria-describedby="githubUrl-help"
          />
          <p id="githubUrl-help" className="input-help">
            Canonical HTTPS github.com URLs only. Public repositories only — private
            repositories are never accessed.
          </p>
          <label htmlFor="githubRef" className="input-label">
            Branch or tag (optional)
          </label>
          <input
            id="githubRef"
            type="text"
            placeholder="Defaults to the repository default branch"
            value={githubRef}
            onChange={(e) => {
              setGithubRef(e.target.value);
              setFieldError(null);
            }}
            className="text-input"
            disabled={loading}
            autoComplete="off"
          />
        </div>
      )}

      {fieldError && (
        <p role="alert" className="form-error">
          {fieldError}
        </p>
      )}

      <div className="form-actions">
        <button
          type="submit"
          disabled={loading || (mode === "zip" && !file)}
          className="btn btn-primary"
        >
          <span aria-live="polite">
            {loading ? "Analyzing… (up to 2 min)" : "Analyze Repository"}
          </span>
        </button>
        <button
          ref={sampleButtonRef}
          type="button"
          disabled={loading}
          onClick={handleSample}
          className="btn btn-secondary"
        >
          <span aria-live="polite">
            {loading ? "Analyzing…" : "Run bundled sample"}
          </span>
        </button>
      </div>
    </form>
  );
}
