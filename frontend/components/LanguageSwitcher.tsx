"use client";

import { useTranslation } from "react-i18next";
import { setStoredLanguage, type SupportedLanguage } from "@/lib/i18n";
import { apiUpdateLanguage } from "@/lib/api";

const LANGUAGES: { code: SupportedLanguage; label: string }[] = [
  { code: "ru", label: "РУ" },
  { code: "kz", label: "ҚАЗ" },
];

export function LanguageSwitcher({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const { i18n } = useTranslation();
  const inactive = variant === "light" ? "text-[#4A5578] hover:text-[#1E1B4B]" : "text-gray-400 hover:text-white";

  const switchLanguage = (lang: SupportedLanguage) => {
    setStoredLanguage(lang);
    i18n.changeLanguage(lang);
    if (typeof window !== "undefined" && localStorage.getItem("access_token")) {
      apiUpdateLanguage(lang).catch(() => {
        // Best-effort sync — UI already switched via localStorage regardless.
      });
    }
  };

  return (
    <div className={`flex items-center gap-1 rounded-lg p-1 ${variant === "light" ? "bg-[#ECEBFF]" : "bg-border"}`}>
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => switchLanguage(lang.code)}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
            i18n.language === lang.code ? "bg-accent text-white" : inactive
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
