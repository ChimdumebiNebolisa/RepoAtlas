import type { AnalysisIntent } from "@/types/report";
import {
  PRIMARY_ANALYSIS_INTENT,
  SECONDARY_ANALYSIS_INTENTS,
} from "./inputFormSupport";

interface AnalysisIntentSelectorProps {
  analysisIntent: AnalysisIntent;
  disabled: boolean;
  secondaryIntentsOpen: boolean;
  onAnalysisIntentChange: (intent: AnalysisIntent) => void;
  onSecondaryIntentsOpenChange: (open: boolean) => void;
}

export function AnalysisIntentSelector({
  analysisIntent,
  disabled,
  secondaryIntentsOpen,
  onAnalysisIntentChange,
  onSecondaryIntentsOpenChange,
}: AnalysisIntentSelectorProps) {
  const selectedSecondaryIntent = SECONDARY_ANALYSIS_INTENTS.find(
    (option) => option.value === analysisIntent
  );

  return (
    <fieldset className="analysis-intent-fieldset" disabled={disabled}>
      <legend>Focus this Candidate Brief</legend>
      <p>Start with the whole-repository interview walkthrough.</p>
      <div className="analysis-intent-primary">
        <label
          className={`analysis-intent-option ${analysisIntent === PRIMARY_ANALYSIS_INTENT.value ? "is-selected" : ""}`}
        >
          <input
            type="radio"
            name="analysis-intent"
            value={PRIMARY_ANALYSIS_INTENT.value}
            checked={analysisIntent === PRIMARY_ANALYSIS_INTENT.value}
            onChange={() => {
              onAnalysisIntentChange(PRIMARY_ANALYSIS_INTENT.value);
              onSecondaryIntentsOpenChange(false);
            }}
          />
          <span>
            <span className="analysis-intent-label-row">
              <strong>{PRIMARY_ANALYSIS_INTENT.label}</strong>
              <small className="analysis-intent-primary-tag">Start here</small>
            </span>
            <small>{PRIMARY_ANALYSIS_INTENT.description}</small>
          </span>
        </label>
      </div>

      <details
        className="secondary-intents"
        open={secondaryIntentsOpen}
        onToggle={(event) => onSecondaryIntentsOpenChange(event.currentTarget.open)}
      >
        <summary>
          <span>
            <strong>Use a different conversation focus</strong>
            <small>
              {selectedSecondaryIntent
                ? `Selected: ${selectedSecondaryIntent.label}`
                : "Bug, planned change, or pull-request discussion"}
            </small>
          </span>
        </summary>
        <div className="analysis-intent-grid">
          {SECONDARY_ANALYSIS_INTENTS.map((option) => (
            <label
              key={option.value}
              className={`analysis-intent-option ${analysisIntent === option.value ? "is-selected" : ""}`}
            >
              <input
                type="radio"
                name="analysis-intent"
                value={option.value}
                checked={analysisIntent === option.value}
                onChange={() => onAnalysisIntentChange(option.value)}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>
      </details>
    </fieldset>
  );
}
