"use client";

import { useEffect, useRef, useState } from "react";

interface CopyButtonProps {
  text: string;
  label?: string;
  onCopySuccess?: () => void;
}

export function CopyButton({ text, label = "Copy", onCopySuccess }: CopyButtonProps) {
  const [feedback, setFeedback] = useState<"idle" | "success" | "error">("idle");
  const resetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeout.current) clearTimeout(resetTimeout.current);
    };
  }, []);

  function showFeedback(result: "success" | "error") {
    if (resetTimeout.current) clearTimeout(resetTimeout.current);
    setFeedback(result);
    resetTimeout.current = setTimeout(() => setFeedback("idle"), 2000);
  }

  function copyWithBrowserFallback(): boolean {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";

    try {
      document.body.appendChild(textarea);
      textarea.select();
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      textarea.remove();
    }
  }

  async function handleCopy() {
    let copied = false;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = copyWithBrowserFallback();
    }

    showFeedback(copied ? "success" : "error");
    if (copied) {
      onCopySuccess?.();
    }
  }

  const visibleLabel =
    feedback === "success" ? "Copied" : feedback === "error" ? "Copy failed" : label;
  const statusMessage =
    feedback === "success"
      ? "Copied to clipboard."
      : feedback === "error"
        ? "Copy failed. Copy the text manually."
        : "";

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        className="report-action report-action-secondary report-action-compact"
      >
        {visibleLabel}
      </button>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {statusMessage}
      </span>
    </>
  );
}
