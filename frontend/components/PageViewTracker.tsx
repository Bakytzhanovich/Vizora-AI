"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

// Fires a page_view event on every route change so admin analytics can
// compute entry/exit pages per visit. Lives outside any specific page so it
// covers the whole app, including the marketing pages that never mount
// react-query or other page-level data hooks.
export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    track("page_view");
  }, [pathname]);

  return null;
}
