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
    if (!isTelegramWebApp()) return;

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
  }, [router]);

  return null;
}
