"use client";

import { useRouter } from "next/navigation";
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
 * Sticky top banner nudging trial/expired/past_due users toward a plan.
 * Mounted once in the root layout so it shows on every authenticated page
 * without each page needing to wire it up individually.
 */
export function TrialBanner() {
  const router = useRouter();
  const { isAuthenticated, subscription } = useAuth();

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
