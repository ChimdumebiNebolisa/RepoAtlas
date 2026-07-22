"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import type { AnalysisIntent, Report } from "@/types/report";
import { clientMaxZipBytes, clientMaxZipMbLabel } from "@/lib/ingestLimitsClient";
import { AnalysisIntentSelector } from "./AnalysisIntentSelector";
import {
  formatApiError,
  formatReportFetchError,
  type InputMode,
  validateGithubInput,
} from "./inputFormSupport";
import { RepositoryInputControls } from "./RepositoryInputControls";
import { useAnalysisRequest } from "./useAnalysisRequest";

export {
  formatApiError,
  formatReportFetchError,
  isValidReportId,
  validateGithubInput,
} from "./inputFormSupport";

interface InputFormProps {
  onAnalyzeStart: () => void;
  onAnalyzeComplete: (report: Report, reportId: string | null) => void;
  onAnalyzeError: (message: string) => void;
  loading: boolean;
  sampleButtonRef?: RefObject<HTMLButtonElement | null>;
}

export interface InputFormHandle {
  generateSample: () => void;
}

const subscribeToHydration = () => () => undefined;

export const InputForm = forwardRef<InputFormHandle, InputFormProps>(function InputForm(
  {
    onAnalyzeStart,
    onAnalyzeComplete,
    onAnalyzeError,
    loading,
    sampleButtonRef,
  },
  forwardedRef
) {
  const [mode, setMode] = useState<InputMode>("github");
  const [file, setFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [githubRef, setGithubRef] = useState("");
  const [analysisIntent, setAnalysisIntent] = useState<AnalysisIntent>("interview");
  const [secondaryIntentsOpen, setSecondaryIntentsOpen] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const githubUrlInputRef = useRef<HTMLInputElement>(null);
  const githubRefInputRef = useRef<HTMLInputElement>(null);
  const latestGithubUrlRef = useRef<string | null>(null);
  const latestGithubRefRef = useRef<string | null>(null);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );
  const interactionsDisabled = loading || !hydrated;
  const runAnalysis = useAnalysisRequest({
    analysisIntent,
    onAnalyzeComplete,
    onAnalyzeError,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (interactionsDisabled) return;
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

    // Read the submitted controls directly so an immediate click cannot race the
    // controlled-state update produced by the final input event.
    const submittedGithubUrl =
      latestGithubUrlRef.current ?? githubUrlInputRef.current?.value ?? githubUrl;
    const submittedGithubRef =
      latestGithubRefRef.current ?? githubRefInputRef.current?.value ?? githubRef;
    const validationError = validateGithubInput(submittedGithubUrl, submittedGithubRef);
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
          githubUrl: submittedGithubUrl.trim(),
          analysisIntent,
          ...(submittedGithubRef.trim() ? { ref: submittedGithubRef.trim() } : {}),
        }),
      },
      "github"
    );
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFieldError(null);
    const chosen = event.target.files?.[0];
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
    if (interactionsDisabled) return;
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

  useImperativeHandle(forwardedRef, () => ({
    generateSample: () => {
      void handleSample();
    },
  }));

  const switchMode = (next: InputMode) => {
    if (interactionsDisabled) return;
    setMode(next);
    setFieldError(null);
  };

  const clearGithubUrlError = (value: string) => {
    latestGithubUrlRef.current = value;
    setGithubUrl(value);
    setFieldError(null);
  };

  const clearGithubRefError = (value: string) => {
    latestGithubRefRef.current = value;
    setGithubRef(value);
    setFieldError(null);
  };

  return (
    <form onSubmit={handleSubmit} className="input-form" aria-busy={interactionsDisabled}>
      <AnalysisIntentSelector
        analysisIntent={analysisIntent}
        disabled={interactionsDisabled}
        secondaryIntentsOpen={secondaryIntentsOpen}
        onAnalysisIntentChange={setAnalysisIntent}
        onSecondaryIntentsOpenChange={setSecondaryIntentsOpen}
      />

      <div className="quick-start">
        <div className="quick-start-copy">
          <strong>See a complete brief first</strong>
          <span>Use the bundled repository. No upload or URL needed.</span>
        </div>
        <button
          ref={sampleButtonRef}
          type="button"
          disabled={interactionsDisabled}
          onClick={handleSample}
          className="btn btn-primary"
        >
          <span aria-live="polite">
            {loading ? "Generating…" : "Generate sample Candidate Brief"}
          </span>
        </button>
      </div>

      <div className="input-divider"><span>or analyze your repository</span></div>

      <RepositoryInputControls
        mode={mode}
        loading={interactionsDisabled}
        file={file}
        githubUrl={githubUrl}
        githubRef={githubRef}
        hasFieldError={fieldError !== null}
        inputRef={inputRef}
        githubUrlInputRef={githubUrlInputRef}
        githubRefInputRef={githubRefInputRef}
        onModeChange={switchMode}
        onFileChange={handleFileChange}
        onGithubUrlChange={clearGithubUrlError}
        onGithubRefChange={clearGithubRefError}
      />

      {fieldError && (
        <p id="input-form-error" role="alert" className="form-error">
          {fieldError}
        </p>
      )}

      <div className="form-actions">
        <button
          type="submit"
          disabled={interactionsDisabled}
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
});
