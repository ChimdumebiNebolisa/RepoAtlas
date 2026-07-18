"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  captureProductEvent,
  initializeProductAnalytics,
  stableRouteName,
} from "@/lib/productAnalytics";

export function ProductAnalytics({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    initializeProductAnalytics();
    captureProductEvent("route_viewed", { route_name: stableRouteName(pathname) });
  }, [pathname]);

  return children;
}
