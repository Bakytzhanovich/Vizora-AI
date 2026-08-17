"use client";

import { useBranding } from "@/context/BrandingContext";

export function PoweredByFooter() {
  const { branding } = useBranding();
  if (!branding.isWhiteLabel) return null;

  return (
    <div className="fixed bottom-3 right-3 z-10 pointer-events-none">
      <span className="text-[10px] text-secondary/50 select-none">
        Powered by Vizora AI
      </span>
    </div>
  );
}
