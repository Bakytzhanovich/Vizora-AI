"use client";

import type { ReactNode } from "react";
import { Mic } from "lucide-react";
import { useTranslation } from "react-i18next";

const WAVE = [10, 22, 30, 16, 26, 12, 20, 8];

function Phone({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`absolute w-[270px] h-[560px] rounded-[44px] bg-[#1E1B4B] p-2.5 shadow-[0_40px_60px_-30px_rgba(30,27,75,0.6)] ${className}`}>
      <div className="flex h-full w-full flex-col gap-3.5 rounded-[34px] bg-white px-[18px] py-7">{children}</div>
    </div>
  );
}

function MicButton({ size = "lg" }: { size?: "lg" | "md" }) {
  const box = size === "lg" ? "h-[60px] w-[60px] bg-[#1E1B4B]" : "h-14 w-14 bg-[#4C46D8]";
  return (
    <span className={`flex items-center justify-center rounded-full ${box}`}>
      <Mic size={size === "lg" ? 26 : 24} className="text-white" />
    </span>
  );
}

// Hero visual: the consul interview screen and the results screen, styled
// after the real simulator (decision + 0-100 readiness + three 0-10 scores,
// see simulator_service.compute_verdict).
export function HeroPhones() {
  const { t } = useTranslation("landing");

  return (
    <div role="img" aria-label={t("showcase.hero.phones_label")} className="relative h-[350px] w-full sm:h-[560px]">
      <div className="absolute bottom-0 left-1/2 h-[560px] w-[540px] -translate-x-1/2 origin-bottom scale-[0.62] sm:scale-100">
        <Phone className="left-[4%] -bottom-[60px] -rotate-6">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B7393]">
            <span>{t("showcase.phone.consul_mode")}</span>
            <span>{t("showcase.phone.question_meta")}</span>
          </div>
          <div className="rounded-[18px] bg-[#F1F3FA] p-3.5">
            <p className="mb-1 text-[11px] font-bold text-[#6B7393]">{t("showcase.phone.consul")}</p>
            <p lang="en" className="text-base font-bold leading-snug text-[#1E1B4B]">Who is paying for your trip?</p>
          </div>
          <div className="max-w-[85%] self-end rounded-[18px_18px_6px_18px] bg-[#4C46D8] px-3.5 py-3">
            <p lang="en" className="text-[13px] leading-snug text-white">My parents. My father is an engineer in Astana.</p>
          </div>
          <div className="rounded-[14px] bg-[#F5F5FF] p-3 text-xs leading-relaxed text-[#1E1B4B]">
            <b className="text-[#B45309]">{t("showcase.phone.hint_label")}</b> {t("showcase.phone.hint")}
          </div>
          <div className="mt-auto flex flex-col items-center gap-2.5">
            <div className="flex h-[30px] items-center gap-[3px]">
              {WAVE.map((h, i) => (
                <span key={i} className="w-[3px] rounded-sm bg-[#4C46D8]" style={{ height: h }} />
              ))}
            </div>
            <MicButton />
          </div>
        </Phone>

        <Phone className="right-[4%] -bottom-5 rotate-[5deg]">
          <p className="text-[15px] font-extrabold text-[#1E1B4B]">{t("showcase.phone.result_title")}</p>
          <div className="rounded-xl bg-[#DCFCE7] px-3 py-2.5 text-xs leading-snug text-[#14532D]">
            <b>{t("showcase.phone.decision_label")}</b> {t("showcase.phone.decision")}
          </div>
          <div
            className="flex h-[132px] w-[132px] items-center justify-center self-center rounded-full"
            style={{ background: "conic-gradient(#16A34A 0 82%, #E8EBF4 82% 100%)" }}
          >
            <div className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full bg-white">
              <span className="text-[32px] font-extrabold leading-none text-[#1E1B4B]">82</span>
              <span className="text-xs font-extrabold text-[#15803D]">{t("showcase.phone.ready")}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-xs font-semibold text-[#1E1B4B]">
            {[
              ["confidence", "8,5"],
              ["english", "7,8"],
              ["content", "8,4"],
            ].map(([key, score]) => (
              <div key={key} className="flex justify-between rounded-[10px] bg-[#F1F3FA] px-3 py-2.5">
                <span>{t(`showcase.phone.${key}`)}</span>
                <span>{score} / 10</span>
              </div>
            ))}
          </div>
        </Phone>

        <div className="absolute left-0 top-10 flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-[0_16px_30px_-16px_rgba(30,27,75,0.45)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#E0E7FF] text-[13px] font-extrabold text-[#3730A3]">B1</span>
          <span className="text-[13px] font-bold leading-tight text-[#1E1B4B]">
            {t("showcase.phone.english_chip_title")}
            <br />
            <span className="font-semibold text-[#6B7393]">{t("showcase.phone.english_chip_sub")}</span>
          </span>
        </div>
        <div className="absolute right-0 top-0 rounded-2xl bg-white px-4 py-3 text-[13px] font-bold text-[#1E1B4B] shadow-[0_16px_30px_-16px_rgba(30,27,75,0.45)]">
          {t("showcase.phone.docs_chip")}
          <div className="mt-2 h-1.5 w-[150px] rounded-sm bg-[#E8EBF4]">
            <div className="h-1.5 w-[70%] rounded-sm bg-[#4C46D8]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Half-height phone that peeks out of the bottom of a feature card.
export function PhoneSnippet({ frame = "ink", children }: { frame?: "ink" | "indigo"; children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className={`h-[300px] w-[240px] self-center rounded-t-[36px] px-2.5 pt-2.5 ${frame === "ink" ? "bg-[#1E1B4B]" : "bg-[#4C46D8]"}`}
    >
      <div className="flex h-full flex-col gap-2.5 rounded-t-[28px] bg-white px-4 py-[22px] text-[#1E1B4B]">{children}</div>
    </div>
  );
}

export function PlanScreen() {
  const { t } = useTranslation("landing");
  const items = t("showcase.features.plan_items", { returnObjects: true }) as string[];
  return (
    <>
      <p className="mb-1 text-sm font-extrabold">{t("showcase.features.plan_days")}</p>
      {items.map((item, i) => (
        <div key={item} className="flex items-center gap-2.5 rounded-xl bg-[#F5F5FF] p-2.5 text-[13px] font-semibold">
          <span
            className={`h-5 w-5 shrink-0 rounded-full ${
              i < 2 ? "bg-[#16A34A]" : i === 2 ? "border-2 border-[#4C46D8]" : "border-2 border-[#C5CAD9]"
            }`}
          />
          {item}
        </div>
      ))}
    </>
  );
}

export function VoiceScreen() {
  const { t } = useTranslation("landing");
  return (
    <>
      <div className="flex rounded-xl bg-[#F1F3FA] p-1 text-xs font-bold">
        <span className="flex-1 p-2 text-center text-[#6B7393]">{t("showcase.features.voice_trainer")}</span>
        <span className="flex-1 rounded-[9px] bg-[#1E1B4B] p-2 text-center text-white">{t("showcase.features.voice_consul")}</span>
      </div>
      <p lang="en" className="mt-1.5 text-[15px] font-extrabold leading-snug">What will you do after the program?</p>
      <p className="text-xs text-[#6B7393]">{t("showcase.features.voice_timer")}</p>
      <span className="mt-auto self-center">
        <MicButton size="md" />
      </span>
    </>
  );
}

export function AiChatScreen() {
  const { t } = useTranslation("landing");
  return (
    <div className="flex flex-col gap-2.5 text-xs leading-relaxed">
      <div className="max-w-[80%] self-end rounded-[14px_14px_4px_14px] bg-[#4C46D8] px-3 py-2.5 text-white">{t("showcase.features.ai_question")}</div>
      <div className="max-w-[88%] rounded-[14px_14px_14px_4px] bg-[#F1F3FA] px-3 py-2.5">{t("showcase.features.ai_answer")}</div>
      <div className="rounded-xl bg-[#F5F5FF] px-3 py-2.5 font-bold text-[#B45309]">{t("showcase.features.ai_link")}</div>
    </div>
  );
}
