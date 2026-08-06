"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  authenticateWithTelegram,
  getTelegramWebApp,
  isTelegramWebApp,
  parseTgParam,
} from "@/lib/telegram";

/**
 * Invisible client component that auto-authenticates when the app is opened
 * inside a Telegram Mini App. Has no effect in regular browsers.
 */
export function TelegramAuthHandler() {
  const router = useRouter();

  useEffect(() => {
    // The SDK script loads asynchronously (see app/layout.tsx) — it may not
    // be attached to `window` yet on mount, so this runs once immediately
    // (covers an already-cached script) and again if the script's own
    // "telegram-sdk-loaded" event fires afterward.
    let attempted = false;

    function run() {
      if (attempted || !isTelegramWebApp()) return;
      attempted = true;

      const tg = getTelegramWebApp();
      if (!tg) return;

      // Signal Telegram the app is ready and go full-screen
      tg.expand();
      tg.ready();

      // If already authenticated, nothing else to do
      if (typeof window !== "undefined" && localStorage.getItem("access_token")) {
        return;
      }

      // Parse deep-link param from URL
      const { referralCode, redirectPath } = parseTgParam(window.location.search);

      authenticateWithTelegram(referralCode).then((result) => {
        if (!result) return;

        localStorage.setItem("access_token", result.access_token);
        localStorage.setItem("user_id", result.user_id);

        if (result.is_new_user) {
          router.replace("/onboarding");
        } else {
          router.replace(redirectPath ?? "/dashboard");
        }
      });
    }

    run();
    window.addEventListener("telegram-sdk-loaded", run);
    return () => window.removeEventListener("telegram-sdk-loaded", run);
  }, [router]);

  return null;
}
