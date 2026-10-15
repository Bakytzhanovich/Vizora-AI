"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AiChatScreen, PhoneSnippet, PlanScreen, VoiceScreen } from "@/components/landing/PhoneMockups";

function FeatureCard({
  dark = false,
  title,
  text,
  children,
}: {
  dark?: boolean;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col gap-6 overflow-hidden rounded-[32px] px-8 pt-8 ${
        dark ? "bg-[#1E1B4B] text-white" : "bg-white text-[#1E1B4B]"
      }`}
    >
      <div>
        <h3 className="mb-2 text-2xl font-extrabold">{title}</h3>
        <p className={`text-base leading-relaxed ${dark ? "text-[#C7CCE0]" : "text-[#4A5578]"}`}>{text}</p>
      </div>
      {children}
    </div>
  );
}

export function FeaturesSection() {
  const { t } = useTranslation("landing");

  return (
    <section id="how-it-works" className="px-4 pb-24 pt-24 sm:px-6 sm:pt-28">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="mx-auto mb-4 max-w-[720px] text-center text-[32px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[44px]">
          {t("showcase.features.title")}
        </h2>
        <p className="mx-auto mb-16 max-w-[560px] text-center text-lg leading-relaxed text-[#4A5578]">
          {t("showcase.features.subtitle")}
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard title={t("showcase.features.plan_title")} text={t("showcase.features.plan_text")}>
            <PhoneSnippet>
              <PlanScreen />
            </PhoneSnippet>
          </FeatureCard>
          <FeatureCard dark title={t("showcase.features.voice_title")} text={t("showcase.features.voice_text")}>
            <PhoneSnippet frame="indigo">
              <VoiceScreen />
            </PhoneSnippet>
          </FeatureCard>
          <FeatureCard title={t("showcase.features.ai_title")} text={t("showcase.features.ai_text")}>
            <PhoneSnippet>
              <AiChatScreen />
            </PhoneSnippet>
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}

export function AfterVisaSection() {
  const { t } = useTranslation("landing");
  const emergencies = t("showcase.after_visa.emergency_items", { returnObjects: true }) as string[];

  return (
    <section aria-labelledby="after-visa-h" className="px-4 pb-24 sm:px-6">
      <div className="mx-auto max-w-[1200px] rounded-[32px] bg-[#ECEBFF] p-8 sm:rounded-[40px] sm:p-14">
        <h2 id="after-visa-h" className="mb-3 max-w-[720px] text-[30px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[40px]">
          {t("showcase.after_visa.title")}
        </h2>
        <p className="mb-10 max-w-[640px] text-lg leading-relaxed text-[#4A5578]">{t("showcase.after_visa.subtitle")}</p>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-[28px] bg-white p-7">
            <h3 className="mb-4 text-[22px] font-extrabold">{t("showcase.after_visa.emergency_title")}</h3>
            <ul className="flex flex-wrap gap-2 text-[15px] font-semibold">
              {emergencies.map((item) => (
                <li key={item} className="rounded-full bg-[#F5F5FF] px-3.5 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[28px] bg-white p-7">
            <h3 className="mb-4 text-[22px] font-extrabold">{t("showcase.after_visa.trip_title")}</h3>
            <p className="text-base leading-relaxed text-[#4A5578]">{t("showcase.after_visa.trip_text")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

type AgencyRow = { name: string; readiness: string; english: string; docs: string };

const READINESS_COLORS = ["text-[#15803D]", "text-[#B45309]", "text-[#B42318]"];

export function AgencySection() {
  const { t } = useTranslation("landing");
  const rows = t("showcase.agency.rows", { returnObjects: true }) as AgencyRow[];
  const grid = "grid grid-cols-[1.4fr_1.2fr_0.6fr_0.9fr] gap-2";

  return (
    <section id="agencies" className="px-4 pb-24 sm:px-6">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-12 rounded-[32px] bg-white p-8 sm:rounded-[40px] sm:p-14">
        <div className="min-w-0 flex-[1_1_340px]">
          <h2 className="mb-4 text-[30px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[40px]">{t("showcase.agency.title")}</h2>
          <p className="mb-7 text-lg leading-relaxed text-[#4A5578]">{t("showcase.agency.text")}</p>
          <Link href="/agency/register" className="inline-block rounded-[14px] bg-[#4C46D8] px-[26px] py-[15px] text-base font-bold text-white hover:bg-[#3F39C4]">
            {t("showcase.agency.cta")}
          </Link>
        </div>
        <div role="img" aria-label={t("showcase.agency.table_label")} className="min-w-0 flex-[1_1_520px] rounded-[20px] bg-[#1E1B4B] p-2.5">
          <div className="overflow-x-auto rounded-xl bg-white p-5">
            <p className="mb-3.5 text-[15px] font-extrabold">{t("showcase.agency.table_title")}</p>
            <div className="flex min-w-[460px] flex-col gap-2 text-[13px] font-semibold">
              <div className={`${grid} px-3 text-[#6B7393]`}>
                <span>{t("showcase.agency.col_student")}</span>
                <span>{t("showcase.agency.col_readiness")}</span>
                <span>{t("showcase.agency.col_english")}</span>
                <span>{t("showcase.agency.col_docs")}</span>
              </div>
              {rows.map((row, i) => (
                <div key={row.name} className={`${grid} items-center rounded-[10px] bg-[#F7F8FC] px-3 py-2.5`}>
                  <span>{row.name}</span>
                  <span className={READINESS_COLORS[i]}>{row.readiness}</span>
                  <span>{row.english}</span>
                  <span>{row.docs}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  const { t } = useTranslation("landing");

  return (
    <section className="px-4 pb-24 sm:px-6">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-8 rounded-[32px] bg-[#1E1B4B] p-8 text-white sm:rounded-[40px] sm:px-14 sm:py-16">
        <div className="max-w-[620px]">
          <h2 className="mb-3 text-[32px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[44px]">{t("showcase.final.title")}</h2>
          <p className="text-lg leading-relaxed text-[#C7CCE0]">{t("showcase.final.text")}</p>
        </div>
        <Link href="/register" className="rounded-[14px] bg-[#FFB547] px-[30px] py-[17px] text-[17px] font-bold text-[#1E1B4B] hover:bg-[#FFA81F]">
          {t("showcase.final.cta")}
        </Link>
      </div>
    </section>
  );
}
