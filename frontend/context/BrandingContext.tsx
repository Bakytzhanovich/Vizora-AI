"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface Branding {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  isWhiteLabel: boolean;
}

const DEFAULT_BRANDING: Branding = {
  name: "Vizora AI",
  logoUrl: null,
  primaryColor: "#6C63FF",
  isWhiteLabel: false,
};

const STORAGE_KEY = "wl_branding";

interface BrandingContextValue {
  branding: Branding;
  isLoading: boolean;
  refreshBranding: () => void;
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_BRANDING,
  isLoading: false,
  refreshBranding: () => {},
});

// globals.css defines --color-accent as a "R G B" triplet (not a hex string)
// so Tailwind's accent/NN opacity modifier can compose it via rgb(var(..)/NN)
// — convert the agency's hex brand color to that same format before writing it.
function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

// Mixes the brand color toward white so hover/light variants stay legible
// instead of freezing at the default purple's #7C75FF/#9C8BFF — see finding:
// only --color-accent was overridden, so any hover:bg-accent-hover or
// text-accent-light element silently reverted to the default purple.
function lighten([r, g, b]: [number, number, number], amount: number): string {
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `${mix(r)} ${mix(g)} ${mix(b)}`;
}

function applyColor(color: string) {
  if (typeof document === "undefined") return;
  const rgb = hexToRgb(color);
  if (!rgb) return;
  const style = document.documentElement.style;
  style.setProperty("--color-accent", rgb.join(" "));
  style.setProperty("--color-accent-hover", lighten(rgb, 0.15));
  style.setProperty("--color-accent-light", lighten(rgb, 0.35));
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBranding = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    setIsLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/profile/me`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.branding) {
        const b: Branding = {
          name: data.branding.name ?? "Vizora AI",
          logoUrl: data.branding.logo_url ?? null,
          primaryColor: data.branding.primary_color ?? "#6C63FF",
          isWhiteLabel: data.branding.is_white_label ?? false,
        };
        setBranding(b);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
        applyColor(b.primaryColor);
      }
    } catch {
      // network error — keep cached/default
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Restore from cache immediately to avoid flash
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const b = JSON.parse(cached) as Branding;
        setBranding(b);
        applyColor(b.primaryColor);
      } catch {}
    }
    fetchBranding();
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, isLoading, refreshBranding: fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
