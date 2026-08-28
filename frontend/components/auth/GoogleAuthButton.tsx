"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { isTelegramWebApp } from "@/lib/telegram";

const GoogleAuthContent = dynamic(() => import("./GoogleAuthContent"), {
  ssr: false,
});

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

interface Props {
  onSuccess: (idToken: string) => void;
  onError?: () => void;
}

export function GoogleAuthButton({ onSuccess, onError }: Props) {
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    // Keep the third-party GSI script out of the critical render path.
    const timer = window.setTimeout(() => setGoogleReady(true), 1000);
    return () => window.clearTimeout(timer);
  }, []);

  // The Telegram SDK script loads asynchronously (see app/layout.tsx), so
  // isTelegramWebApp() can still read false on first render even inside
  // Telegram — recheck once the script announces it has loaded.
  const [inTelegram, setInTelegram] = useState(isTelegramWebApp());

  useEffect(() => {
    if (inTelegram) return;
    const recheck = () => setInTelegram(isTelegramWebApp());
    window.addEventListener("telegram-sdk-loaded", recheck);
    return () => window.removeEventListener("telegram-sdk-loaded", recheck);
  }, [inTelegram]);

  if (!GOOGLE_CLIENT_ID) return null;
  if (!googleReady) return null;
  // Google blocks its OAuth/GSI flow inside embedded WebViews (Telegram Mini
  // App included) — the button silently fails to initialize there instead of
  // erroring, which looks like a frozen page. Hide it rather than show
  // something that can never work.
  if (inTelegram) return null;

  return <GoogleAuthContent onSuccess={onSuccess} onError={onError} />;
}
