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

function applyColor(color: string) {
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--color-accent", color);
  }
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
