"use client";

import { useState } from "react";
import type { Report } from "@/types/report";
import {
  captureReportShared,
  type ReportShareMethod,
  type ReportShareType,
  type ReportVariant,
} from "@/lib/productAnalytics";
import { createPortableShareLink } from "@/lib/portableSharing";
import type {
  PrivateReportSharingState,
  ShareDeliveryResult,
} from "./reportActionState";

async function copyShareLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = url;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  }
}

async function deliverShareLink(url: string): Promise<ShareDeliveryResult> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: "RepoAtlas Candidate Brief",
        text: "A read-only Candidate Brief from RepoAtlas.",
        url,
      });
      return "native";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
      return null;
    }
  }
  return (await copyShareLink(url)) ? "clipboard" : null;
}

async function createShareLink({
  report,
  reportId,
}: {
  report: Report;
  reportId?: string | null;
}): Promise<{ url: string; expiresAt: string; shareType: ReportShareType }> {
  if (reportId) {
    const res = await fetch(`/api/reports/${reportId}/share`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message ?? "Failed to create a private link.");
    }
    return {
      url: `${window.location.origin}${data.sharePath as string}`,
      expiresAt: data.expiresAt as string,
      shareType: "stored_link",
    };
  }

  const portable = await createPortableShareLink(report, window.location.origin);
  return {
    url: portable.url,
    expiresAt: portable.expiresAt,
    shareType: "portable_link",
  };
}

export function usePrivateReportSharing({
  report,
  reportId,
  variant,
}: {
  report: Report;
  reportId?: string | null;
  variant: ReportVariant;
}): PrivateReportSharingState {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareCounted, setShareCounted] = useState(false);

  const handleShareCandidateBrief = async () => {
    if (shareLoading || variant !== "live") return;
    setShareLoading(true);
    setShareError(null);
    setShareMessage(null);
    try {
      const { url, expiresAt, shareType } = await createShareLink({
        report,
        reportId,
      });
      const method = await deliverShareLink(url);
      if (method === "cancelled") return;
      if (!method) {
        throw new Error(
          "Could not share or copy the private link. Export PDF to share it instead."
        );
      }

      setShareUrl(url);
      setShareExpiresAt(expiresAt);
      setShareMessage(
        method === "native"
          ? "Shared successfully. The private link expires in 7 days."
          : "Private link copied. It expires in 7 days."
      );
      if (!shareCounted) {
        captureReportShared(method as ReportShareMethod, shareType);
        setShareCounted(true);
      }
    } catch (error) {
      setShareError(
        error instanceof Error
          ? error.message
          : "Could not create a private link. Export PDF to share this brief."
      );
    } finally {
      setShareLoading(false);
    }
  };

  return {
    shareUrl,
    shareExpiresAt,
    shareLoading,
    shareError,
    shareMessage,
    handleShareCandidateBrief,
  };
}
