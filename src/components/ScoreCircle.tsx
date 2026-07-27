"use client";

interface ScoreCircleProps {
  score: number;
  variant?: "priority" | "risk";
}

const SIZE = 40;
const STROKE = 4;
const R = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

const SCORE_TEXT = {
  priority: {
    name: "Priority score",
    meaning:
      "Relative reading order. Higher scores are better places to start.",
  },
  risk: {
    name: "Risk score",
    meaning:
      "Combined structural risk from size, coupling, structural complexity, and test proximity. Higher scores mean more structural risk. This is a static signal, not measured coverage.",
  },
} as const;

export function ScoreCircle({ score, variant = "priority" }: ScoreCircleProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;

  const strokeColor =
    variant === "risk"
      ? "stroke-red-500 dark:stroke-red-400"
      : "stroke-emerald-600 dark:stroke-emerald-400";
  const trackColor = "stroke-slate-200 dark:stroke-slate-600";
  const scoreText = SCORE_TEXT[variant];
  const valueText = `${clamped} out of 100. ${scoreText.meaning}`;

  return (
    <span
      className="relative inline-flex size-10 cursor-help items-center justify-center"
      role="meter"
      aria-label={scoreText.name}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-valuetext={valueText}
      title={`${scoreText.name}: ${valueText}`}
    >
      <svg
        width={SIZE}
        height={SIZE}
        className="-rotate-90 shrink-0"
        aria-hidden
      >
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          className={trackColor}
        />
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={strokeColor}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-xs font-medium tabular-nums text-slate-700 dark:text-slate-300"
        aria-hidden="true"
      >
        {clamped}
      </span>
    </span>
  );
}
