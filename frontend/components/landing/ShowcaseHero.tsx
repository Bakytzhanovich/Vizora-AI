"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { HeroPhones } from "@/components/landing/PhoneMockups";

// The headline is the LCP element, so nothing above the fold is animated
// (same reasoning as the previous dark hero).
export function ShowcaseHero() {
  const { t } = useTranslation("landing");

  return (
    <section id="students" className="px-4 pt-2 sm:px-6">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-end gap-8 overflow-hidden rounded-[32px] bg-[#4C46D8] px-6 pt-12 sm:rounded-[40px] sm:px-14 sm:pt-16">
        <div className="min-w-0 flex-[1_1_420px] pb-4 text-white sm:pb-[72px]">
          <p className="mb-5 inline-block rounded-full bg-white/[0.18] px-4 py-2 text-[15px] font-semibold">
            {t("showcase.hero.badge")}
          </p>
          <h1 className="mb-6 text-[34px] font-extrabold leading-[1.06] min-[420px]:text-[40px] tracking-[-0.035em] sm:text-[60px]">
            {t("showcase.hero.title")}
          </h1>
          <p className="mb-9 max-w-[480px] text-lg leading-relaxed text-[#E3E1FF] sm:text-[19px]">
            {t("showcase.hero.subtitle")}
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link
              href="/register"
              className="rounded-[14px] bg-[#FFB547] px-[30px] py-[17px] text-[17px] font-bold text-[#1E1B4B] hover:bg-[#FFA81F] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-[#FFB547]"
            >
              {t("showcase.hero.cta")}
            </Link>
            <span className="text-[15px] text-[#E3E1FF]">{t("showcase.hero.note")}</span>
          </div>
        </div>

        <div className="min-w-0 flex-[1_1_520px]">
          <HeroPhones />
        </div>
      </div>
    </section>
  );
}
