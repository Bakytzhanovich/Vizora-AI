"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

import { apiGetMe, apiGetPlans, type Plan } from "@/lib/api";
import { VizoraMark } from "@/components/VizoraMark";

const CONSUMER_PLAN_IDS = ["basic", "standard", "premium"];

function formatKzt(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount) + " ₸";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/**
 * Shown once, right after registration and before onboarding, so new users
 * know upfront that the 7-day trial ends and what plans exist — instead of
 * only finding out via a banner days later.
 */
export default function WelcomePage() {
  const router = useRouter();
  const { t } = useTranslation(["welcome", "pricing"]);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      router.replace("/login");
      return;
    }
    Promise.all([apiGetMe(), apiGetPlans()])
      .then(([me, plansRes]) => {
        if (me.profile) {
          // Already onboarded (e.g. navigated back here) — nothing to show.
          router.replace("/dashboard");
          return;
        }
        setTrialEndsAt(me.subscription?.trial_ends_at ?? null);
        setPlans(plansRes.plans.filter((p) => CONSUMER_PLAN_IDS.includes(p.id)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const handleContinue = () => router.push("/onboarding");

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#6C63FF]/30 border-t-[#6C63FF] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 py-12 flex items-center justify-center">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <VizoraMark className="h-10 w-10 mx-auto mb-4" priority />
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F0F0FF] mb-2">{t("title")}</h1>
          <p className="text-[#8B8BA7] text-sm">{t("subtitle")}</p>
        </div>

        <div className="bg-[#13131A] border border-[#6C63FF]/30 rounded-2xl p-5 mb-6 text-center">
          <span className="inline-block text-xs font-bold px-3 py-1 rounded-full bg-[#6C63FF]/15 text-[#6C63FF] mb-3">
            🔥 {t("trial_badge")}
          </span>
          <p className="text-[#F0F0FF] text-sm">
            {trialEndsAt ? t("trial_desc", { date: formatDate(trialEndsAt) }) : null}
          </p>
        </div>

        <h2 className="text-[#F0F0FF] font-semibold text-sm mb-1">{t("after_trial_title")}</h2>
        <p className="text-[#8B8BA7] text-xs mb-4">{t("after_trial_desc")}</p>

        <div className="grid grid-cols-3 gap-2.5 mb-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl p-3 border ${
                plan.id === "standard" ? "border-[#6C63FF] bg-[#6C63FF]/10" : "border-[#1E1E2E] bg-[#13131A]"
              }`}
            >
              <div className="text-xs font-bold text-[#F0F0FF] mb-1">{t(`pricing:plan_names.${plan.id}`)}</div>
              <div className="text-sm font-bold text-[#6C63FF] mb-2">{formatKzt(plan.prices_kzt.monthly)}</div>
              <div className="text-[10px] text-[#8B8BA7] flex items-center gap-1">
                <Check size={11} className="text-[#00D4AA] shrink-0" />
                {plan.limits.simulator_sessions_per_month === null
                  ? "∞"
                  : plan.limits.simulator_sessions_per_month}{" "}
                {t("sessions_short")}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleContinue}
          className="w-full bg-gradient-to-r from-[#6C63FF] to-[#9C8BFF] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#6C63FF]/20 text-sm transition-transform hover:scale-[1.01]"
        >
          {t("cta_continue")}
        </button>

        <p className="text-center text-[#8B8BA7] text-xs mt-4">{t("skip_hint")}</p>
      </div>
    </div>
  );
}
