"use client";

import { useEffect } from "react";

/** Registers the service worker unconditionally on every page load — needed
 * for PWA installability (Chrome's install prompt requires an active service
 * worker registration, not just one gated behind the push-notification opt-in
 * in lib/push.ts::subscribeToPush). Registration is idempotent, so this is
 * safe to run alongside that separate push-triggered registration. */
export function PwaServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Best-effort — a failed registration just means no offline
        // fallback / install prompt, not a broken app.
      });
    }
  }, []);

  return null;
}
