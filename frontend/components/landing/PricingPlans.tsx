"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

export interface LandingPrices {
  standard: number;
  premium: number;
}

function formatKzt(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount) + " ₸";
}

// prices is null when /api/payments/plans couldn't be reached at render
// time; the price line is then left out rather than showing a hardcoded copy
// that could drift from the backend (PLAN_PRICES_KZT is the source of truth).
export function PricingPlans({ prices }: { prices: LandingPrices | null }) {
  const { t } = useTranslation("landing");
  const features = (key: string) => t(`showcase.pricing.${key}_features`, { returnObjects: true }) as string[];

  const outlineCta =
    "mt-auto rounded-[14px] border-2 border-[#1E1B4B] p-3.5 text-center text-base font-bold text-[#1E1B4B] hover:bg-[#F5F5FF]";

  return (
    <section id="pricing" aria-labelledby="pricing-h" className="px-4 pb-24 sm:px-6">
      <div className="mx-auto max-w-[1200px]">
        <h2 id="pricing-h" className="mb-3 text-center text-[32px] font-extrabold tracking-[-0.03em] sm:text-[44px]">
          {t("showcase.pricing.title")}
        </h2>
        <p className="mb-12 text-center text-lg text-[#4A5578]">{t("showcase.pricing.subtitle")}</p>
        <div className="grid gap-5 md:grid-cols-3">
          <div className="flex flex-col gap-5 rounded-[32px] bg-white p-8">
            <div>
              <h3 className="mb-2 text-[22px] font-extrabold">{t("showcase.pricing.free_name")}</h3>
              <p className="text-[40px] font-extrabold tracking-[-0.02em]">0 ₸</p>
            </div>
            <ul className="list-disc pl-5 text-base leading-[1.9] text-[#2E3A5E]">
              {features("free").map((f) => <li key={f}>{f}</li>)}
            </ul>
            <Link href="/register" className={outlineCta}>
              {t("showcase.pricing.free_cta")}
            </Link>
          </div>

          <div className="relative flex flex-col gap-5 rounded-[32px] bg-[#1E1B4B] p-8 text-white">
            <span className="absolute right-6 top-6 rounded-full bg-[#FFB547] px-3 py-1.5 text-[13px] font-bold text-[#1E1B4B]">
              {t("showcase.pricing.popular")}
            </span>
            <div>
              <h3 className="mb-2 text-[22px] font-extrabold">{t("showcase.pricing.standard_name")}</h3>
              {prices && (
                <p className="text-[40px] font-extrabold tracking-[-0.02em]">
                  {formatKzt(prices.standard)}
                  <span className="text-[17px] font-semibold text-[#C7CCE0]"> {t("showcase.pricing.per_month")}</span>
                </p>
              )}
            </div>
            <ul className="list-disc pl-5 text-base leading-[1.9] text-[#E4E7F2]">
              {features("standard").map((f) => <li key={f}>{f}</li>)}
            </ul>
            <Link href="/pricing" className="mt-auto rounded-[14px] bg-[#FFB547] p-4 text-center text-base font-bold text-[#1E1B4B] hover:bg-[#FFA81F]">
              {t("showcase.pricing.standard_cta")}
            </Link>
          </div>

          <div className="flex flex-col gap-5 rounded-[32px] bg-white p-8">
            <div>
              <h3 className="mb-2 text-[22px] font-extrabold">{t("showcase.pricing.premium_name")}</h3>
              {prices && (
                <p className="text-[40px] font-extrabold tracking-[-0.02em]">
                  {formatKzt(prices.premium)}
                  <span className="text-[17px] font-semibold text-[#6B7393]"> {t("showcase.pricing.per_month")}</span>
                </p>
              )}
            </div>
            <ul className="list-disc pl-5 text-base leading-[1.9] text-[#2E3A5E]">
              {features("premium").map((f) => <li key={f}>{f}</li>)}
            </ul>
            <Link href="/pricing" className={outlineCta}>
              {t("showcase.pricing.premium_cta")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
