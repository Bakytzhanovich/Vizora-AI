"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import {
  apiGetPlans,
  apiCreatePayment,
  apiMockCompletePayment,
  type Plan,
  type CreatePaymentResponse,
} from "@/lib/api";

const CONSUMER_PLAN_IDS = ["basic", "standard", "premium"];

function formatKzt(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount) + " ₸";
}

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation("pricing");
  const { isAuthenticated, subscription } = useAuth();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(true);
  const [startingPlan, setStartingPlan] = useState<string | null>(null);
  const [pendingPayment, setPendingPayment] = useState<
    (CreatePaymentResponse & { plan: string }) | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const discountCode = searchParams.get("discount") || undefined;

  useEffect(() => {
    apiGetPlans()
      .then((d) => setPlans(d.plans.filter((p) => CONSUMER_PLAN_IDS.includes(p.id))))
      .catch(() => setError("Не удалось загрузить тарифы"))
      .finally(() => setLoading(false));
  }, []);

  const handleStart = async (planId: string) => {
    if (!isAuthenticated) {
      router.push("/register");
      return;
    }
    setError(null);
    setStartingPlan(planId);
    try {
      const result = await apiCreatePayment(planId, billingPeriod, discountCode);
      if (result.mock_mode) {
        setPendingPayment({ ...result, plan: planId });
      } else {
        window.location.href = result.pay_url;
      }
    } catch {
      setError("Не удалось создать платёж. Попробуй ещё раз.");
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
    } catch {
      setError("Не удалось подтвердить тестовый платёж.");
    } finally {
      setStartingPlan(null);
    }
  };

  const featureRows = (plan: Plan) => {
    const l = plan.limits;
    const rows: { label: string; ok: boolean }[] = [
      { label: t("features.faq_unlimited"), ok: true },
      {
        label:
          l.simulator_sessions_per_month === null
            ? t("features.sessions_unlimited")
            : t(
                l.simulator_sessions_per_month === 1 ? "features.sessions" : "features.sessions_plural",
                { count: l.simulator_sessions_per_month }
              ),
        ok: true,
      },
      { label: l.consul_mode ? t("features.mode_trainer_consul") : t("features.mode_trainer"), ok: true },
      { label: t("features.risk_analysis"), ok: l.risk_analysis },
      { label: t("features.after_visa"), ok: l.after_visa },
      { label: t("features.emergency"), ok: l.emergency },
    ];
    if (plan.id !== "basic") rows.push({ label: t("features.priority_support"), ok: true });
    return rows;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 py-10">
      <div className="max-w-5xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#F0F0FF] mb-2">{t("hero_title")}</h1>
          <p className="text-[#8B8BA7]">{t("hero_subtitle")}</p>
        </div>

        {discountCode && (
          <div className="max-w-md mx-auto mb-6 text-center text-sm font-semibold text-[#FF6B6B] bg-[#FF6B6B]/10 border border-[#FF6B6B]/30 rounded-xl py-2 px-4">
            {t("discount_active")}
          </div>
        )}

        {/* Billing toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex bg-[#13131A] border border-[#1E1E2E] rounded-xl p-1">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                billingPeriod === "monthly" ? "bg-[#6C63FF] text-white" : "text-[#8B8BA7]"
              }`}
            >
              {t("toggle_monthly")}
            </button>
            <button
              onClick={() => setBillingPeriod("yearly")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                billingPeriod === "yearly" ? "bg-[#6C63FF] text-white" : "text-[#8B8BA7]"
              }`}
            >
              {t("toggle_yearly")}
            </button>
          </div>
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-6 text-center text-sm text-[#FF6B6B]">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-2 border-[#6C63FF]/30 border-t-[#6C63FF] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-5 mb-10">
            {plans.map((plan) => {
              const isPopular = plan.id === "standard";
              const isCurrent = subscription?.status === "active" && subscription.plan === plan.id;
              const price = plan.prices_kzt[billingPeriod];
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl p-6 border flex flex-col ${
                    isPopular
                      ? "border-[#6C63FF] bg-[#13131A] shadow-lg shadow-[#6C63FF]/10"
                      : "border-[#1E1E2E] bg-[#13131A]"
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-[#6C63FF] text-white">
                      ⭐ {t("popular_badge")}
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-[#F0F0FF] mb-1">
                    {t(`plan_names.${plan.id}`)}
                  </h3>
                  <div className="mb-5">
                    <span className="text-3xl font-bold text-[#F0F0FF]">{formatKzt(price)}</span>
                    <span className="text-[#8B8BA7] text-sm">
                      {billingPeriod === "monthly" ? t("per_month") : t("per_year")}
                    </span>
                  </div>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {featureRows(plan).map((row, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        {row.ok ? (
                          <Check size={16} className="text-[#00D4AA] shrink-0 mt-0.5" />
                        ) : (
                          <X size={16} className="text-[#8B8BA7] shrink-0 mt-0.5" />
                        )}
                        <span className={row.ok ? "text-[#F0F0FF]" : "text-[#8B8BA7]"}>{row.label}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleStart(plan.id)}
                    disabled={startingPlan === plan.id || isCurrent}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${
                      isPopular
                        ? "bg-[#6C63FF] hover:bg-[#7C75FF] text-white"
                        : "bg-[#1E1E2E] hover:bg-[#2A2A3A] text-[#F0F0FF]"
                    }`}
                  >
                    {isCurrent ? t("cta_current") : startingPlan === plan.id ? t("processing") : t("cta_start")}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Mock payment confirmation */}
        {pendingPayment && (
          <div className="max-w-md mx-auto mb-10 rounded-2xl border border-[#6C63FF]/40 bg-[#13131A] p-5 text-center">
            <p className="text-xs text-[#8B8BA7] mb-3">{t("mock_mode_notice")}</p>
            <p className="text-[#F0F0FF] font-semibold mb-4">{formatKzt(pendingPayment.amount)}</p>
            <button
              onClick={handleMockComplete}
              disabled={startingPlan === pendingPayment.plan}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-[#00D4AA] hover:bg-[#00B894] text-black disabled:opacity-60"
            >
              {startingPlan === pendingPayment.plan ? t("processing") : t("mock_complete_button")}
            </button>
          </div>
        )}

        {/* Trust row */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-[#8B8BA7] mb-14">
          <span>{t("trust.secure_payment")}</span>
          <span>{t("trust.cancel_anytime")}</span>
          <span>{t("trust.trial_included")}</span>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-[#F0F0FF] mb-5 text-center">{t("faq_title")}</h2>
          <div className="space-y-3">
            {(t("faq", { returnObjects: true }) as { q: string; a: string }[]).map((item, i) => (
              <div key={i} className="rounded-xl border border-[#1E1E2E] bg-[#13131A] p-4">
                <p className="text-[#F0F0FF] font-semibold text-sm mb-1.5">{item.q}</p>
                <p className="text-[#8B8BA7] text-sm">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-[#6C63FF]/30 border-t-[#6C63FF] rounded-full animate-spin" />
        </div>
      }
    >
      <PricingContent />
    </Suspense>
  );
}
