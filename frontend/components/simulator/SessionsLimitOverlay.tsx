"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Lock, Star, Gem } from "lucide-react";

interface Props {
  planLabel: string;
  sessionsUsed: number;
  sessionsLimit: number;
  /** true for FREE's lifetime cap (never resets); false for a paid plan's
   * monthly quota (Standard: 15/month). */
  neverResets?: boolean;
  onWait: () => void;
  /** Only used for the FREE lifetime-cap case — aggregate practice stats
   * shown as "here's what you accomplished" before the upgrade pitch. */
  totalQuestions?: number;
  avgScore?: number | null;
  standardPriceKzt?: number | null;
  premiumPriceKzt?: number | null;
}

function nextMonthResetLabel(locale: string): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toLocaleDateString(locale === "kz" ? "kk-KZ" : "ru-RU", { day: "numeric", month: "long" });
}

function formatKzt(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount) + " ₸/мес";
}

/** Shown over the simulator's mode-select screen once a plan's session quota
 * is used up — either FREE's lifetime cap, or a paid plan's monthly quota
 * (e.g. Standard: 15/month). */
export function SessionsLimitOverlay({
  planLabel,
  sessionsUsed,
  sessionsLimit,
  neverResets = false,
  onWait,
  totalQuestions,
  avgScore,
  standardPriceKzt,
  premiumPriceKzt,
}: Props) {
  const router = useRouter();
  const { t, i18n } = useTranslation("simulator");

  if (neverResets) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-sm flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[#6C63FF]/15 flex items-center justify-center mx-auto mb-3">
            <Lock size={22} className="text-[#6C63FF]" />
          </div>
          <h2 className="text-lg font-bold text-[#F0F0FF] mb-1">
            {t("sessions_limit.used_all_free", { count: sessionsLimit })}
          </h2>

          {(totalQuestions != null || avgScore != null) && (
            <div className="bg-[#0A0A0F] rounded-xl p-3 mt-4 mb-4 text-sm text-left space-y-1">
              <p className="text-[#8B8BA7] mb-1.5">
                {t("sessions_limit.in_sessions_you", {
                  count: sessionsUsed,
                  sessionWord: t(sessionsUsed === 1 ? "sessions_limit.session_word_one" : "sessions_limit.session_word_other"),
                })}
              </p>
              {totalQuestions != null && (
                <p className="text-[#F0F0FF]">
                  {t("sessions_limit.answered_questions", { count: totalQuestions })}
                </p>
              )}
              {avgScore != null && (
                <p className="text-[#F0F0FF]">
                  {t("sessions_limit.average_score", { score: avgScore.toFixed(1) })}
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-[#8B8BA7] mb-4">{t("sessions_limit.need_subscription")}</p>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => router.push("/pricing")}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold bg-[#6C63FF] hover:bg-[#7C75FF] text-white transition-colors"
            >
              <Star size={14} />
              {t("sessions_limit.standard_cta", { price: standardPriceKzt != null ? formatKzt(standardPriceKzt) : "" })}
            </button>
            <button
              onClick={() => router.push("/pricing")}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold bg-[#1E1E2E] hover:bg-[#2A2A3A] text-[#F0F0FF] transition-colors"
            >
              <Gem size={14} />
              {t("sessions_limit.premium_cta", { price: premiumPriceKzt != null ? formatKzt(premiumPriceKzt) : "" })}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-[#6C63FF]/15 flex items-center justify-center mx-auto mb-3">
          <Lock size={22} className="text-[#6C63FF]" />
        </div>
        <h2 className="text-lg font-bold text-[#F0F0FF] mb-4">{t("sessions_limit.sessions_ended")}</h2>

        <div className="bg-[#0A0A0F] rounded-xl p-3 mb-4 text-sm">
          <p className="text-[#8B8BA7]">
            {t("sessions_limit.plan_limit", {
              plan: planLabel,
              count: sessionsLimit,
              sessionWord: t(
                sessionsLimit === 1 ? "sessions_limit.session_word_nom_one" : "sessions_limit.session_word_nom_other"
              ),
            })}
          </p>
          <p className="text-[#F0F0FF] font-semibold mt-1">
            {t("sessions_limit.used_of", { used: sessionsUsed, limit: sessionsLimit })}
          </p>
        </div>

        <p className="text-xs text-[#8B8BA7] mb-5">
          {t("sessions_limit.next_reset", { date: nextMonthResetLabel(i18n.language) })}
        </p>

        <p className="text-xs text-[#8B8BA7] mb-4">
          {t("sessions_limit.upgrade_hint", {
            plan: t("plan_names.premium", { ns: "pricing" }),
            benefit: t("features.unlimited_sessions", { ns: "pricing" }),
          })}
        </p>

        <div className="flex gap-2.5">
          <button
            onClick={() => router.push("/pricing")}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#6C63FF] hover:bg-[#7C75FF] text-white transition-colors"
          >
            {t("sessions_limit.upgrade_cta")}
          </button>
          <button
            onClick={onWait}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#1E1E2E] hover:bg-[#2A2A3A] text-[#F0F0FF] transition-colors"
          >
            {t("sessions_limit.wait_cta")}
          </button>
        </div>
      </div>
    </div>
  );
}
