"use client";

import { useState, useRef, type RefObject } from "react";
import type { AnalysisIntent, Report } from "@/types/report";
import { ERROR_CODES } from "@/lib/errors";
import { parseGithubRepoUrl, isValidGitRef } from "@/lib/github";
import { clientMaxZipBytes, clientMaxZipMbLabel } from "@/lib/ingestLimitsClient";
import { clientFailureDiagnostic } from "@/lib/clientFailureDiagnostics";
import {
  analysisEntrySource,
  captureAnalysisEvent,
  type AnalysisInputType,
} from "@/lib/productAnalytics";

const FALLBACK_ANALYSIS_MESSAGE = "Analysis failed. Check server logs.";

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type InputMode = "zip" | "github";

const ANALYSIS_INTENT_OPTIONS: Array<{
  value: AnalysisIntent;
  label: string;
  description: string;
}> = [
  {
    value: "interview",
    label: "Interview walkthrough",
    description: "Explain the whole repository clearly.",
  },
  {
    value: "bug",
    label: "Investigate a bug",
    description: "Trace likely entry points and risk signals.",
  },
  {
    value: "planned_change",
    label: "Plan a change",
    description: "Map boundaries, impact, and validation.",
  },
  {
    value: "pull_request",
    label: "Discuss a pull request",
    description: "Prepare a file-backed review path.",
  },
];

interface InputFormProps {
  onAnalyzeStart: () => void;
  onAnalyzeComplete: (report: Report, reportId: string | null) => void;
  onAnalyzeError: (message: string) => void;
  loading: boolean;
  sampleButtonRef?: RefObject<HTMLButtonElement | null>;
}

interface ApiErrorLike {
  code?: string;
  message?: string;
}

export function formatApiError(
  payload: ApiErrorLike | null | undefined,
  fallback: string,
  retryAfter?: string | null
) {
  if (!payload) return fallback;
  const base = payload.code && payload.message
    ? `${payload.code}: ${payload.message}`
    : payload.message || payload.code || fallback;
  if (
    (payload.code === ERROR_CODES.RATE_LIMITED ||
      payload.code === ERROR_CODES.RATE_LIMIT_EXCEEDED) &&
    retryAfter &&
    /^\d+$/.test(retryAfter)
  ) {
    return `${base} Retry in ${retryAfter} seconds.`;
  }
  return base;
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
  const [mode, setMode] = useState<InputMode>("github");
  const [file, setFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [githubRef, setGithubRef] = useState("");
  const [analysisIntent, setAnalysisIntent] = useState<AnalysisIntent>("interview");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Runs the analyze request and validates the reportId in every flow.
  const runAnalysis = async (init: RequestInit, inputType: AnalysisInputType) => {
    const entrySource = analysisEntrySource(window.location.search);
    const entryProperties = entrySource ? { entry_source: entrySource } : {};
    captureAnalysisEvent("analysis_started", inputType, analysisIntent, entryProperties);
    try {
      const res = await fetch("/api/analyze", init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        captureAnalysisEvent("analysis_failed", inputType, analysisIntent, {
          ...entryProperties,
          stage: "analysis",
          status_code: res.status,
          error_code: data.code ?? ERROR_CODES.ANALYSIS_FAILED,
        });
        onAnalyzeError(
          formatApiError(data, FALLBACK_ANALYSIS_MESSAGE, res.headers.get("retry-after"))
        );
        return;
      }
      const { reportId, report: inlineReport, persisted } = data as {
        reportId?: unknown;
        report?: Report;
        persisted?: boolean;
      };
      if (!isValidReportId(reportId)) {
        captureAnalysisEvent("analysis_failed", inputType, analysisIntent, {
          ...entryProperties,
          stage: "analysis_response",
          error_code: "INVALID_REPORT_ID",
        });
        onAnalyzeError("Invalid response: missing or malformed reportId.");
        return;
      }

      if (persisted === false && inlineReport) {
        captureAnalysisEvent("analysis_completed", inputType, analysisIntent, entryProperties);
        onAnalyzeComplete(inlineReport, null);
        return;
      }

      const reportRes = await fetch(`/api/reports/${reportId}`);
      const reportPayload = await reportRes.json().catch(() => ({}));
      if (!reportRes.ok) {
        const diagnostic = clientFailureDiagnostic(
          "report_load",
          reportPayload.code,
          reportRes.status
        );
        captureAnalysisEvent("analysis_failed", inputType, analysisIntent, {
          ...entryProperties,
          stage: "report_load",
          status_code: reportRes.status,
          error_code: diagnostic.errorCode,
        });
        console.error(JSON.stringify(diagnostic));
        onAnalyzeError(formatReportFetchError(reportPayload, reportRes.status, reportId));
        return;
      }
      captureAnalysisEvent("analysis_completed", inputType, analysisIntent, entryProperties);
      onAnalyzeComplete(reportPayload as Report, reportId);
    } catch {
      const diagnostic = clientFailureDiagnostic("network");
      captureAnalysisEvent("analysis_failed", inputType, analysisIntent, {
        ...entryProperties,
        stage: "network",
        error_code: diagnostic.errorCode,
      });
      console.error(JSON.stringify(diagnostic));
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
      if (file.size > clientMaxZipBytes()) {
        setFieldError(`Zip file must be ${clientMaxZipMbLabel()}MB or smaller.`);
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("analysisIntent", analysisIntent);
      onAnalyzeStart();
      await runAnalysis({ method: "POST", body: formData }, "zip");
      return;
    }

    const validationError = validateGithubInput(githubUrl, githubRef);
    if (validationError) {
      setFieldError(validationError);
      return;
    }
    onAnalyzeStart();
    await runAnalysis(
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubUrl: githubUrl.trim(),
          analysisIntent,
          ...(githubRef.trim() ? { ref: githubRef.trim() } : {}),
        }),
      },
      "github"
    );
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
    if (chosen.size > clientMaxZipBytes()) {
      setFieldError(`Zip file must be ${clientMaxZipMbLabel()}MB or smaller.`);
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
    await runAnalysis(
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sample: true, analysisIntent }),
      },
      "sample"
    );
  };

  const switchMode = (next: InputMode) => {
    if (loading) return;
    setMode(next);
    setFieldError(null);
  };

  const hasFieldError = fieldError !== null;

  return (
    <form onSubmit={handleSubmit} className="input-form" aria-busy={loading}>
      <fieldset className="analysis-intent-fieldset" disabled={loading}>
        <legend>Focus this Candidate Brief</legend>
        <p>Choose the conversation you need to prepare for.</p>
        <div className="analysis-intent-grid">
          {ANALYSIS_INTENT_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`analysis-intent-option ${analysisIntent === option.value ? "is-selected" : ""}`}
            >
              <input
                type="radio"
                name="analysis-intent"
                value={option.value}
                checked={analysisIntent === option.value}
                onChange={() => setAnalysisIntent(option.value)}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="quick-start">
        <div className="quick-start-copy">
          <strong>See a complete brief first</strong>
          <span>Use the bundled repository. No upload or URL needed.</span>
        </div>
        <button
          ref={sampleButtonRef}
          type="button"
          disabled={loading}
          onClick={handleSample}
          className="btn btn-primary"
        >
          <span aria-live="polite">
            {loading ? "Generating…" : "Generate sample Candidate Brief"}
          </span>
        </button>
      </div>

      <div className="input-divider"><span>or analyze your repository</span></div>

      <div
        role="tablist"
        aria-label="Repository input method"
        className="input-mode-toggle"
      >
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
              aria-invalid={hasFieldError && mode === "zip"}
              aria-describedby={hasFieldError && mode === "zip" ? "input-form-error" : undefined}
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
            aria-invalid={hasFieldError && mode === "github"}
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
            aria-invalid={hasFieldError && mode === "github"}
          />
        </div>
      )}

      {fieldError && (
        <p id="input-form-error" role="alert" className="form-error">
          {fieldError}
        </p>
      )}

      <div className="form-actions">
        <button
          type="submit"
          disabled={loading}
          className="btn btn-secondary"
        >
          <span aria-live="polite">
            {loading
              ? "Analyzing… (up to 2 min)"
              : mode === "github"
                ? "Analyze public GitHub repository"
                : "Analyze uploaded ZIP"}
          </span>
        </button>
      </div>
    </form>
  );
}
