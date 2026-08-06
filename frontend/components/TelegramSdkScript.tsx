"use client";

import Script from "next/script";

/** Split out into its own client component because next/script's onLoad
 * handler can't be passed as a prop from a Server Component (layout.tsx). */
export function TelegramSdkScript() {
  return (
    <Script
      src="https://telegram.org/js/telegram-web-app.js"
      strategy="afterInteractive"
      onLoad={() => window.dispatchEvent(new Event("telegram-sdk-loaded"))}
    />
  );
}
