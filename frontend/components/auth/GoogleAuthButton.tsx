"use client";

import { useEffect, useState } from "react";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { isTelegramWebApp } from "@/lib/telegram";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

interface Props {
  onSuccess: (idToken: string) => void;
  onError?: () => void;
}

export function GoogleAuthButton({ onSuccess, onError }: Props) {
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
  // Google blocks its OAuth/GSI flow inside embedded WebViews (Telegram Mini
  // App included) — the button silently fails to initialize there instead of
  // erroring, which looks like a frozen page. Hide it rather than show
  // something that can never work.
  if (inTelegram) return null;

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID} locale="ru">
      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-[#1E1E2E]" />
        <span className="text-[#8B8BA7] text-xs">или</span>
        <div className="h-px flex-1 bg-[#1E1E2E]" />
      </div>
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={(credentialResponse) => {
            if (credentialResponse.credential) onSuccess(credentialResponse.credential);
          }}
          onError={onError}
          theme="outline"
          shape="pill"
          size="large"
          text="continue_with"
        />
      </div>
    </GoogleOAuthProvider>
  );
}
