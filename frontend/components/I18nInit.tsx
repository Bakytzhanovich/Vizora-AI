"use client";

import { useEffect } from "react";

import i18n, { getStoredLanguage } from "@/lib/i18n";

export function I18nInit() {
  useEffect(() => {
    const stored = getStoredLanguage();
    if (stored !== i18n.language) i18n.changeLanguage(stored);
  }, []);

  return null;
}
