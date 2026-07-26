"use client";

import { useBranding } from "@/context/BrandingContext";
import { VizoraMark } from "@/components/VizoraMark";

interface Props {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { logo: "h-6 w-6", diamond: "text-base", text: "text-sm" },
  md: { logo: "h-7 w-7", diamond: "text-lg", text: "text-base" },
  lg: { logo: "h-9 w-9", diamond: "text-2xl", text: "text-xl" },
};

export function BrandedLogo({ size = "md", className = "" }: Props) {
  const { branding } = useBranding();
  const s = sizes[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {branding.logoUrl ? (
        <img
          src={branding.logoUrl}
          alt={branding.name}
          className={`${s.logo} rounded-lg object-cover`}
        />
      ) : branding.isWhiteLabel ? (
        <span className={`${s.diamond} font-bold`} style={{ color: branding.primaryColor }}>
          ◈
        </span>
      ) : (
        <VizoraMark className={s.logo} />
      )}
      <span className={`text-[#F0F0FF] font-bold ${s.text}`}>{branding.name}</span>
    </div>
  );
}
