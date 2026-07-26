"use client";

import { useTranslation } from "react-i18next";
import { setStoredLanguage, type SupportedLanguage } from "@/lib/i18n";
import { apiUpdateLanguage } from "@/lib/api";

const LANGUAGES: { code: SupportedLanguage; label: string }[] = [
  { code: "ru", label: "РУ" },
  { code: "kz", label: "ҚАЗ" },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

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
    <div className="flex items-center gap-1 bg-[#1E1E2E] rounded-lg p-1">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => switchLanguage(lang.code)}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
            i18n.language === lang.code
              ? "bg-[#6C63FF] text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
