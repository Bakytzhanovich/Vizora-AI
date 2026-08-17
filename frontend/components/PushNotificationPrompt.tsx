"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getExistingPushSubscription,
  getNotificationPermission,
  isPushSupported,
  subscribeToPush,
} from "@/lib/push";

const DISMISS_KEY = "push_prompt_dismissed";

/**
 * Non-intrusive banner asking logged-in users to enable browser push
 * notifications. Only web users lack Telegram reminders, so this only makes
 * sense here — Telegram Mini App users already get reminders via the bot.
 */
export function PushNotificationPrompt() {
  const { t } = useTranslation("common");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("access_token")) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    if (getNotificationPermission() !== "default") return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const existing = await getExistingPushSubscription();
      if (!cancelled && !existing) setVisible(true);
    }, 3000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  const handleEnable = async () => {
    setVisible(false);
    await subscribeToPush();
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-2xl border border-white/10 bg-card p-4 shadow-xl sm:left-auto sm:right-4">
      <p className="text-sm font-semibold text-primary">{t("push.title")}</p>
      <p className="mt-1 text-xs text-secondary">{t("push.body")}</p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleEnable}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
        >
          {t("push.enable")}
        </button>
        <button
          onClick={handleDismiss}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-secondary"
        >
          {t("push.dismiss")}
        </button>
      </div>
    </div>
  );
}
