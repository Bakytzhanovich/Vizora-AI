"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";
import { captureFirstTouch, getFirstTouch } from "@/lib/attribution";

// Fires a page_view event on every route change so admin analytics can
// compute entry/exit pages per visit. Lives outside any specific page so it
// covers the whole app, including the marketing pages that never mount
// react-query or other page-level data hooks.
export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Must run before the event is sent: on a landing with ?utm_source=... this
    // is what makes the very first page_view already carry the attribution.
    captureFirstTouch();
    track("page_view", getFirstTouch() ?? undefined);
  }, [pathname]);

  return null;
}
