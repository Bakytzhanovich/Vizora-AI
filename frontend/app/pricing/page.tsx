"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, Lock, GraduationCap, Star, Lightbulb } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { apiGetPlans, apiGetSocialProof, type Plan } from "@/lib/api";

const CONSUMER_PLAN_IDS = ["free", "standard", "premium"];
const TELEGRAM_SUPPORT_URL = "https://t.me/vizora_support";

function formatKzt(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount) + " ₸";
}

interface FeatureRow {
  label: string;
  ok: boolean;
}

function PricingContent() {
  const router = useRouter();
  const { t } = useTranslation("pricing");
  const { isAuthenticated, subscription } = useAuth();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [socialProof, setSocialProof] = useState<{ student_count: number; average_score: number | null } | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiGetPlans(), apiGetSocialProof()])
      .then(([p, sp]) => {
        setPlans(p.plans.filter((pl) => CONSUMER_PLAN_IDS.includes(pl.id)));
        setSocialProof(sp);
      })
      .catch(() => setError("Не удалось загрузить тарифы"))
      .finally(() => setLoading(false));
  }, []);

  const handleStart = (planId: string) => {
    if (planId === "free") {
      router.push(isAuthenticated ? "/dashboard" : "/register");
      return;
    }
    // Standard/Premium are activated manually by email after the student
    // pays via Telegram (see routers/internal.py) — an account has to exist
    // first or that lookup 404s, so an anonymous visitor registers before
    // being sent to Telegram.
    if (!isAuthenticated) {
      router.push("/register");
      return;
    }
    window.open(TELEGRAM_SUPPORT_URL, "_blank", "noopener,noreferrer");
  };

  const featureRows = (plan: Plan): FeatureRow[] => {
    const l = plan.limits;
    if (plan.id === "free") {
      return [
        { label: t("features.faq_limited", { count: l.faq_per_day }), ok: true },
        {
          label: t("features.sessions_total_limited_time", {
            count: l.simulator_sessions_total,
            minutes: l.simulator_session_max_minutes,
          }),
          ok: true,
        },
        { label: t("features.mode_trainer"), ok: true },
        { label: t("features.documents_checklist"), ok: true },
        { label: t("features.risk_profile"), ok: true },
        { label: t("features.risk_solutions"), ok: false },
        { label: t("features.consul_mode"), ok: false },
        { label: t("features.detailed_feedback"), ok: false },
        { label: t("features.ds160_guide"), ok: false },
        { label: t("features.after_visa"), ok: false },
        { label: t("features.emergency"), ok: false },
      ];
    }
    if (plan.id === "standard") {
      return [
        { label: t("features.faq_unlimited"), ok: true },
        { label: t("features.sessions_plural", { count: l.simulator_sessions_per_month }), ok: true },
        { label: t("features.mode_trainer_consul"), ok: true },
        { label: t("features.detailed_feedback"), ok: true },
        { label: t("features.risk_solutions_full"), ok: true },
        { label: t("features.ds160_guide_full"), ok: true },
        { label: t("features.after_visa"), ok: true },
        { label: t("features.emergency"), ok: true },
        { label: t("features.unlimited_sessions"), ok: false },
        { label: t("features.pdf_report"), ok: false },
        { label: t("features.early_access"), ok: false },
      ];
    }
    // premium
    return [
      { label: t("features.everything_standard"), ok: true },
      { label: t("features.unlimited_sessions"), ok: true },
      { label: t("features.pdf_report"), ok: true },
      { label: t("features.priority_support"), ok: true },
      { label: t("features.early_access"), ok: true },
    ];
  };

  const standardPlan = plans.find((p) => p.id === "standard");
  const standardMonthly = standardPlan?.prices_kzt.monthly;

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => (window.history.length > 1 ? router.back() : router.push(isAuthenticated ? "/dashboard" : "/"))}
          className="flex items-center gap-1.5 text-[#8B8BA7] hover:text-[#F0F0FF] text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          {t("common:common.back")}
        </button>

        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#F0F0FF] mb-2">{t("hero_title")}</h1>
          <p className="text-[#8B8BA7]">{t("hero_subtitle")}</p>
        </div>

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
          <div className="grid md:grid-cols-3 gap-5 mb-8">
            {plans.map((plan) => {
              const isFree = plan.id === "free";
              const isPopular = plan.id === "standard";
              const isCurrent = subscription?.plan === plan.id;
              const price = plan.prices_kzt[billingPeriod];
              const monthlyEquivalent = billingPeriod === "yearly" ? Math.round(price / 12) : null;
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
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-[#6C63FF] text-white">
                      <Star size={11} fill="currentColor" /> {t("popular_badge")}
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-[#F0F0FF] mb-1">
                    {t(`plan_names.${plan.id}`)}
                  </h3>
                  <div className="mb-5">
                    {isFree ? (
                      <>
                        <span className="text-3xl font-bold text-[#F0F0FF]">0 ₸</span>
                        <div className="text-[#8B8BA7] text-xs mt-0.5">{t("forever")}</div>
                      </>
                    ) : billingPeriod === "yearly" ? (
                      <>
                        <span className="text-3xl font-bold text-[#F0F0FF]">{formatKzt(monthlyEquivalent ?? 0)}</span>
                        <span className="text-[#8B8BA7] text-sm">{t("per_month")}</span>
                        <div className="text-[#8B8BA7] text-xs mt-0.5">{formatKzt(price)}{t("per_year")}</div>
                      </>
                    ) : (
                      <span className="text-3xl font-bold text-[#F0F0FF]">
                        {formatKzt(price)}
                        <span className="text-[#8B8BA7] text-sm">{t("per_month")}</span>
                      </span>
                    )}
                  </div>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {featureRows(plan).map((row, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        {row.ok ? (
                          <Check size={16} className="text-[#00D4AA] shrink-0 mt-0.5" />
                        ) : (
                          <Lock size={14} className="text-[#8B8BA7] shrink-0 mt-1" />
                        )}
                        <span className={row.ok ? "text-[#F0F0FF]" : "text-[#8B8BA7]"}>{row.label}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleStart(plan.id)}
                    disabled={isCurrent}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${
                      isPopular
                        ? "bg-[#6C63FF] hover:bg-[#7C75FF] text-white"
                        : "bg-[#1E1E2E] hover:bg-[#2A2A3A] text-[#F0F0FF]"
                    }`}
                  >
                    {isCurrent ? t("cta_current") : isFree ? t("cta_free") : t("cta_start")}
                  </button>
                  {!isFree && !isCurrent && (
                    <p className="text-[#8B8BA7] text-[11px] text-center mt-2">{t("telegram_cta_notice")}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Value box */}
        {standardMonthly != null && (
          <div className="max-w-2xl mx-auto mb-10 rounded-2xl border border-[#6C63FF]/30 bg-[#6C63FF]/5 p-5 flex items-start gap-3">
            <Lightbulb size={20} className="text-[#6C63FF] shrink-0 mt-0.5" />
            <div>
              <p className="text-[#F0F0FF] font-semibold text-sm mb-1">{t("value_box.title")}</p>
              <p className="text-[#8B8BA7] text-sm">
                {t("value_box.text", { price: formatKzt(standardMonthly) })}
              </p>
            </div>
          </div>
        )}

        {/* Social proof */}
        {socialProof && (
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-[#F0F0FF] mb-4">
            {socialProof.student_count > 0 && (
              <span className="flex items-center gap-1.5">
                <GraduationCap size={15} className="text-[#6C63FF]" />
                {t("social_proof.students", { count: socialProof.student_count })}
              </span>
            )}
            {socialProof.average_score != null && (
              <span className="flex items-center gap-1.5">
                <Star size={15} className="text-[#F59E0B]" fill="currentColor" />
                {t("social_proof.average_score", { score: socialProof.average_score })}
              </span>
            )}
          </div>
        )}

        {/* Trust row */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-[#8B8BA7] mb-14">
          <span>{t("trust.no_card_free")}</span>
          <span>{t("trust.cancel_anytime")}</span>
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
