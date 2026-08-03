"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const COLOR_STYLES: Record<string, string> = {
  yellow: "bg-[#F59E0B]/15 border-[#F59E0B]/30 text-[#F59E0B]",
  orange: "bg-[#F97316]/15 border-[#F97316]/30 text-[#F97316]",
  red: "bg-[#FF6B6B]/15 border-[#FF6B6B]/30 text-[#FF6B6B]",
};

const BUTTON_STYLES: Record<string, string> = {
  yellow: "bg-[#F59E0B]/20 hover:bg-[#F59E0B]/30",
  orange: "bg-[#F97316]/20 hover:bg-[#F97316]/30",
  red: "bg-[#FF6B6B]/20 hover:bg-[#FF6B6B]/30",
};

const ICONS: Record<string, string> = {
  warning: "⏰",
  danger: "🔥",
  urgent: "🔔",
};

/**
 * Sticky top banner nudging a user to fix payment after a failed Kaspi
 * renewal charge — the only case that still produces a banner now that FREE
 * is a permanent plan (no more trial/expiry banners). Mounted once in the
 * root layout so it shows on every authenticated page without each page
 * needing to wire it up individually.
 */
export function PaymentIssueBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, subscription, refreshProfile } = useAuth();

  // Lives in the root layout, which doesn't remount on client-side
  // navigation — so useAuth()'s own mount-time fetch goes stale the moment
  // subscription state changes elsewhere (e.g. completing a payment on
  // /pricing, then router.push()-ing to /dashboard). Re-fetch on every route
  // change so the banner reflects the page the user just landed on.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (isAuthenticated) refreshProfile();
  }, [pathname, isAuthenticated, refreshProfile]);

  if (!isAuthenticated || !subscription?.banner) return null;

  const banner = subscription.banner;
  const colorClass = COLOR_STYLES[banner.color] ?? COLOR_STYLES.orange;
  const icon = ICONS[banner.type] ?? "⏰";

  return (
    <div className={`sticky top-0 z-40 border-b ${colorClass}`}>
      <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0">{icon}</span>
          <span className="text-sm font-medium truncate">{banner.message}</span>
        </div>
        <button
          onClick={() => router.push(banner.cta_url)}
          className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            BUTTON_STYLES[banner.color] ?? BUTTON_STYLES.orange
          }`}
        >
          {banner.cta} →
        </button>
      </div>
    </div>
  );
}
