"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Timer } from "lucide-react";

interface Props {
  answered: number;
  total: number;
  onSeeResults: () => void;
}

/** Full-screen upgrade prompt shown the instant a FREE-plan session hits its
 * time cap mid-conversation (see /simulator/respond's trial_session_ended
 * response) — replaces the interview screen entirely rather than layering
 * over it, since there's no session left to return to. */
export function TrialSessionEndedModal({ answered, total, onSeeResults }: Props) {
  const router = useRouter();
  const { t } = useTranslation("simulator");

  const answeredKey =
    answered === 1 ? "trial_ended.answered_one" : answered < 5 ? "trial_ended.answered_few" : "trial_ended.answered_many";

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0F] flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-full bg-[#6C63FF]/15 flex items-center justify-center mx-auto mb-4">
          <Timer size={26} className="text-[#6C63FF]" />
        </div>
        <h1 className="text-xl font-bold text-[#F0F0FF] mb-2">{t("trial_ended.title")}</h1>
        <p className="text-[#8B8BA7] text-sm mb-1">{t(answeredKey, { count: answered })}</p>
        <p className="text-[#8B8BA7] text-sm mb-6">{t("trial_ended.real_interview_note", { count: total })}</p>

        <p className="text-[#F0F0FF] text-sm font-semibold mb-3">{t("trial_ended.continue_with_standard")}</p>

        <button
          onClick={() => router.push("/pricing")}
          className="w-full bg-gradient-to-r from-[#6C63FF] to-[#9C8BFF] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#6C63FF]/20 text-sm transition-transform hover:scale-[1.01] mb-3"
        >
          {t("trial_ended.subscribe_cta")}
        </button>
        <button
          onClick={onSeeResults}
          className="w-full text-[#8B8BA7] hover:text-[#F0F0FF] text-sm font-medium py-2 transition-colors"
        >
          {t("trial_ended.see_results")}
        </button>
      </div>
    </div>
  );
}
