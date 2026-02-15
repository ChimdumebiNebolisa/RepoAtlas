"use client";

interface ScoreCircleProps {
  score: number;
  tooltip: string;
  variant?: "priority" | "risk";
}

const SIZE = 40;
const STROKE = 4;
const R = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function ScoreCircle({ score, tooltip, variant = "priority" }: ScoreCircleProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;

  const strokeColor =
    variant === "risk"
      ? "stroke-red-500 dark:stroke-red-400"
      : "stroke-emerald-600 dark:stroke-emerald-400";
  const trackColor = "stroke-slate-200 dark:stroke-slate-600";

  return (
    <span
      className="relative inline-flex size-10 cursor-help items-center justify-center"
      title={tooltip}
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
      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium tabular-nums text-slate-700 dark:text-slate-300">
        {clamped}
      </span>
    </span>
  );
}
