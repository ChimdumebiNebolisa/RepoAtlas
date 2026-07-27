interface ArchitectureGraphControlsProps {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

export function ArchitectureGraphControls({
  zoomIn,
  zoomOut,
  reset,
}: ArchitectureGraphControlsProps) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={zoomIn}
        className="report-action report-action-secondary report-action-compact"
      >
        Zoom in
      </button>
      <button
        type="button"
        onClick={zoomOut}
        className="report-action report-action-secondary report-action-compact"
      >
        Zoom out
      </button>
      <button
        type="button"
        onClick={reset}
        className="report-action report-action-secondary report-action-compact"
      >
        Reset
      </button>
    </div>
  );
}
