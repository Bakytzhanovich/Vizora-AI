"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/hooks/useAuth";
import {
  apiGetTrialSummary,
  apiGetPlans,
  apiCreatePayment,
  apiMockCompletePayment,
  type TrialSummary,
  type Plan,
  type CreatePaymentResponse,
} from "@/lib/api";

const CONSUMER_PLAN_IDS = ["basic", "standard", "premium"];

function formatKzt(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount) + " ₸";
}

export default function PaywallPage() {
  const router = useRouter();
  const { t } = useTranslation("paywall");
  const { isAuthenticated, isLoading, subscription } = useAuth();

  const [summary, setSummary] = useState<TrialSummary | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [startingPlan, setStartingPlan] = useState<string | null>(null);
  const [pendingPayment, setPendingPayment] = useState<
    (CreatePaymentResponse & { plan: string }) | null
  >(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    // Trial still active or already paid — nothing to gate, send them back in.
    if (subscription && subscription.status !== "expired" && subscription.status !== "canceled" && subscription.status !== "past_due") {
      router.replace("/dashboard");
      return;
    }
    Promise.all([apiGetTrialSummary(), apiGetPlans()])
      .then(([s, p]) => {
        setSummary(s);
        setPlans(p.plans.filter((pl) => CONSUMER_PLAN_IDS.includes(pl.id)));
      })
      .catch(() => {});
  }, [isAuthenticated, isLoading, subscription, router]);

  const handleStart = async (planId: string) => {
    setStartingPlan(planId);
    try {
      const result = await apiCreatePayment(planId, "monthly");
      if (result.mock_mode) {
        setPendingPayment({ ...result, plan: planId });
      } else {
        window.location.href = result.pay_url;
      }
    } catch {
      // Swallowed — this is a prototype; a real build would surface a toast here.
    } finally {
      setStartingPlan(null);
    }
  };

  const handleMockComplete = async () => {
    if (!pendingPayment) return;
    setStartingPlan(pendingPayment.plan);
    try {
      await apiMockCompletePayment(pendingPayment.payment_id);
      router.push("/dashboard?payment=success");
    } finally {
      setStartingPlan(null);
    }
  };

  if (isLoading || !summary) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#6C63FF]/30 border-t-[#6C63FF] rounded-full animate-spin" />
      </div>
    );
  }

  const hasStats = summary.sessions_count > 0;

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 py-10 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-[#F0F0FF] mb-2">{t("title")}</h1>
          <p className="text-[#8B8BA7]">{t("subtitle")}</p>
        </div>

        <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5 mb-6">
          {hasStats ? (
            <>
              <p className="text-[#8B8BA7] text-sm mb-3">{t("summary_title")}</p>
              <div className="space-y-2 text-sm text-[#F0F0FF]">
                <p>✅ {t("sessions_line", { count: summary.sessions_count })}</p>
                {summary.first_score !== null && summary.last_score !== null && (
                  <p>📈 {t("score_line", { first: summary.first_score, last: summary.last_score })}</p>
                )}
                {summary.days_to_interview !== null && (
                  <p>📅 {t("interview_line", { days: summary.days_to_interview })}</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-[#8B8BA7] text-sm text-center">{t("no_stats")}</p>
          )}
        </div>

        <p className="text-center text-[#F0F0FF] font-semibold mb-5">{t("encourage")}</p>

        <div className="grid grid-cols-3 gap-2.5 mb-6">
          {plans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => handleStart(plan.id)}
              disabled={startingPlan === plan.id}
              className={`rounded-xl p-3 text-center border transition-colors disabled:opacity-60 ${
                plan.id === "standard"
                  ? "border-[#6C63FF] bg-[#6C63FF]/10"
                  : "border-[#1E1E2E] bg-[#0A0A0F] hover:border-[#6C63FF]/50"
              }`}
            >
              <div className="text-xs font-bold text-[#F0F0FF] uppercase mb-1">{plan.id}</div>
              <div className="text-sm font-bold text-[#6C63FF]">{formatKzt(plan.prices_kzt.monthly)}</div>
              {plan.id === "standard" && <div className="text-[10px] text-[#6C63FF] mt-0.5">⭐</div>}
            </button>
          ))}
        </div>

        {pendingPayment && (
          <div className="mb-6 rounded-2xl border border-[#6C63FF]/40 bg-[#13131A] p-4 text-center">
            <p className="text-[#F0F0FF] font-semibold mb-3">{formatKzt(pendingPayment.amount)}</p>
            <button
              onClick={handleMockComplete}
              disabled={startingPlan === pendingPayment.plan}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-[#00D4AA] hover:bg-[#00B894] text-black disabled:opacity-60"
            >
              Симулировать оплату
            </button>
          </div>
        )}

        <div className="text-center border-t border-[#1E1E2E] pt-5">
          <p className="text-xs text-[#8B8BA7] mb-2">
            {t("stay_free_title")} {t("stay_free_desc")}
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-[#8B8BA7] hover:text-[#F0F0FF] underline"
          >
            {t("stay_free_cta")}
          </button>
        </div>
      </div>
    </div>
  );
}
