import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ruCommon from "@/public/locales/ru/common.json";
import ruDashboard from "@/public/locales/ru/dashboard.json";
import ruOnboarding from "@/public/locales/ru/onboarding.json";
import ruSimulator from "@/public/locales/ru/simulator.json";
import ruChat from "@/public/locales/ru/chat.json";
import ruDocuments from "@/public/locales/ru/documents.json";
import ruEmergency from "@/public/locales/ru/emergency.json";
import ruLanding from "@/public/locales/ru/landing.json";
import ruPricing from "@/public/locales/ru/pricing.json";
import ruPaywall from "@/public/locales/ru/paywall.json";
import ruWelcome from "@/public/locales/ru/welcome.json";

import kzCommon from "@/public/locales/kz/common.json";
import kzDashboard from "@/public/locales/kz/dashboard.json";
import kzOnboarding from "@/public/locales/kz/onboarding.json";
import kzSimulator from "@/public/locales/kz/simulator.json";
import kzChat from "@/public/locales/kz/chat.json";
import kzDocuments from "@/public/locales/kz/documents.json";
import kzEmergency from "@/public/locales/kz/emergency.json";
import kzLanding from "@/public/locales/kz/landing.json";
import kzPricing from "@/public/locales/kz/pricing.json";
import kzPaywall from "@/public/locales/kz/paywall.json";
import kzWelcome from "@/public/locales/kz/welcome.json";

export const STORAGE_KEY = "vizora_language";
export const SUPPORTED_LANGUAGES = ["ru", "kz"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function getStoredLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return "ru";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "kz" ? "kz" : "ru";
}

export function setStoredLanguage(lang: SupportedLanguage): void {
  localStorage.setItem(STORAGE_KEY, lang);
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      ru: {
        common: ruCommon,
        dashboard: ruDashboard,
        onboarding: ruOnboarding,
        simulator: ruSimulator,
        chat: ruChat,
        documents: ruDocuments,
        emergency: ruEmergency,
        landing: ruLanding,
        pricing: ruPricing,
        paywall: ruPaywall,
        welcome: ruWelcome,
      },
      kz: {
        common: kzCommon,
        dashboard: kzDashboard,
        onboarding: kzOnboarding,
        simulator: kzSimulator,
        chat: kzChat,
        documents: kzDocuments,
        emergency: kzEmergency,
        landing: kzLanding,
        pricing: kzPricing,
        paywall: kzPaywall,
        welcome: kzWelcome,
      },
    },
    lng: getStoredLanguage(),
    fallbackLng: "ru",
    defaultNS: "common",
    ns: [
      "common",
      "dashboard",
      "onboarding",
      "simulator",
      "chat",
      "documents",
      "emergency",
      "landing",
      "pricing",
      "paywall",
      "welcome",
    ],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export default i18n;
