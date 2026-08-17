import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BrandingProvider } from "@/context/BrandingContext";
import { TelegramAuthHandler } from "@/components/TelegramAuthHandler";
import { TelegramSdkScript } from "@/components/TelegramSdkScript";
import { PwaServiceWorker } from "@/components/PwaServiceWorker";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import { PaymentIssueBanner } from "@/components/PaymentIssueBanner";
import { BottomNav } from "@/components/BottomNav";
import { I18nInit } from "@/components/I18nInit";
import { PageViewTracker } from "@/components/PageViewTracker";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-inter",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vizora-ai-theta.vercel.app";

export const metadata: Metadata = {
  title: {
    default: "Vizora AI — AI помощник для визы в США",
    template: "%s | Vizora AI",
  },
  description:
    "Подготовься к интервью в консульстве США с персональным AI тренером. Симулятор интервью, FAQ 24/7, чек-лист документов. Для студентов Work & Travel из Казахстана и СНГ.",
  keywords: [
    "Work and Travel",
    "виза в США",
    "J-1 виза",
    "интервью консульство",
    "подготовка к визе",
    "Казахстан",
    "СНГ",
    "AI помощник",
    "симулятор интервью",
    "Work Travel Казахстан",
  ],
  authors: [{ name: "Vizora AI" }],
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Vizora AI — AI помощник для визы в США",
    description:
      "Персональный AI тренер для подготовки к интервью в консульстве США. Work & Travel из Казахстана и СНГ.",
    type: "website",
    locale: "ru_RU",
    siteName: "Vizora AI",
    url: SITE_URL,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Vizora AI — AI помощник для визы в США",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vizora AI — AI помощник для визы в США",
    description:
      "Персональный AI тренер для подготовки к интервью в консульстве США.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vizora AI",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`dark ${inter.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0A0A0F" />
        {/* Telegram Mini App SDK — loaded after hydration so a slow/throttled
            fetch of this script on mobile networks never blocks the initial
            page render for everyone else. TelegramAuthHandler listens for the
            "telegram-sdk-loaded" event as a fallback in case it mounts before
            this finishes loading. */}
        <TelegramSdkScript />
      </head>
      <body className="bg-[#0A0A0F] text-[#F0F0FF] antialiased font-sans">
        <I18nInit />
        <PwaServiceWorker />
        <PageViewTracker />
        <BrandingProvider>
          <TelegramAuthHandler />
          <PushNotificationPrompt />
          <PaymentIssueBanner />
          {children}
          <BottomNav />
        </BrandingProvider>
      </body>
    </html>
  );
}
