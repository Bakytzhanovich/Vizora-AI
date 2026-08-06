"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Lock, Check, Sparkles, Map, MessageCircle, Mic, FileText, LifeBuoy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { RiskCard } from "@/components/dashboard/RiskCard";
import { ModuleCard } from "@/components/dashboard/ModuleCard";
import { DashboardHeaderMenu } from "@/components/dashboard/DashboardHeaderMenu";
import { BrandedLogo } from "@/components/branding/BrandedLogo";
import { PoweredByFooter } from "@/components/branding/PoweredByFooter";
import { AfterVisaCard } from "@/components/after-visa/AfterVisaCard";
import { ReferralCard } from "@/components/referral/ReferralCard";
import { apiGetMe, apiGetRoadmap, apiGetAfterVisaModules, apiGetReferralCode, apiGetPlans } from "@/lib/api";
import type { UserProfile, RiskProfile, SubscriptionInfo } from "@/lib/api";

function formatKzt(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount) + " ₸/мес";
}

const restModuleHrefs = ["/chat", "/simulator", "/documents"] as const;
const restModuleIcons = [MessageCircle, Mic, FileText];
const restModuleKeys = ["chat", "simulator", "documents"] as const;

const riskColors: Record<string, string> = {
  high: "#FF6B6B",
  medium: "#F59E0B",
  low: "#00D4AA",
};

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation(["common", "dashboard"]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [journeyProgress, setJourneyProgress] = useState(10);
  const [afterVisa, setAfterVisa] = useState<{ unlocked: boolean; pct: number; completed: number; total: number } | null>(null);
  const [referralStats, setReferralStats] = useState<{ totalActive: number; nextNeeded: number | null } | null>(null);
  const [standardPriceKzt, setStandardPriceKzt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllRisks, setShowAllRisks] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      router.replace("/login");
      return;
    }
    Promise.all([
      apiGetMe(),
      apiGetRoadmap().catch(() => null),
      apiGetAfterVisaModules().catch(() => null),
      apiGetReferralCode().catch(() => null),
      apiGetPlans().catch(() => null),
    ])
      .then(([me, roadmap, av, ref, plansRes]) => {
        if (me.user.role === "admin") {
          router.replace("/admin/dashboard");
          return;
        }
        if (!me.profile) {
          router.replace("/onboarding");
          return;
        }
        setProfile(me.profile);
        setRiskProfile(me.risk_profile);
        setSubscription(me.subscription);
        if (roadmap) setJourneyProgress(roadmap.progress);
        if (av) setAfterVisa({ unlocked: av.unlocked, pct: av.overall_pct, completed: av.overall_completed, total: av.overall_total });
        if (ref) {
          const active = ref.stats.total_active;
          const next = ref.stats.next_tier;
          setReferralStats({ totalActive: active, nextNeeded: next ? next.referrals_needed - active : null });
        }
        if (plansRes) {
          const standard = plansRes.plans.find((p) => p.id === "standard");
          if (standard) setStandardPriceKzt(standard.prices_kzt.monthly);
        }
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const logout = () => {
    ["access_token", "refresh_token", "user_id", "has_profile", "user_name"].forEach(
      (k) => localStorage.removeItem(k)
    );
    router.push("/login");
  };

  const daysUntilInterview = (() => {
    if (!profile?.interview_date) return null;
    const diff = Math.ceil(
      (new Date(profile.interview_date).getTime() - Date.now()) / 86400000
    );
    return diff > 0 ? diff : null;
  })();

  const overallRisk = riskProfile?.overall_risk ?? "medium";
  const riskColor = riskColors[overallRisk];
  const topRisks = riskProfile?.risks.slice(0, 3) ?? [];
  const isFree = subscription?.plan === "free";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#6C63FF]/30 border-t-[#6C63FF] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 py-6 max-w-5xl mx-auto">
      <PoweredByFooter />
      {/* Top nav */}
      <div className="flex items-center justify-between mb-8">
        <BrandedLogo />
        <DashboardHeaderMenu subscription={subscription} onLogout={logout} />
      </div>

      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-[#F0F0FF] mb-1">
          {t("dashboard:greeting", { name: profile?.name })}
        </h1>
        {daysUntilInterview !== null ? (
          <p className="text-[#8B8BA7]">
            {t("dashboard:interview_date", { days: daysUntilInterview })}
          </p>
        ) : (
          <p className="text-[#8B8BA7]">{t("dashboard:no_interview_date")}</p>
        )}
      </motion.div>

      {/* Progress */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5 mb-5"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[#F0F0FF] text-sm font-semibold">{t("dashboard:progress")}</span>
          <span className="text-[#6C63FF] text-sm font-bold">{journeyProgress}%</span>
        </div>
        <div className="h-2 bg-[#1E1E2E] rounded-full overflow-hidden mb-3">
          <motion.div
            className="h-full bg-gradient-to-r from-[#6C63FF] to-[#9C8BFF] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${journeyProgress}%` }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-[#00D4AA]">
          <Check size={14} />
          <span>{t("dashboard:profile_complete")}</span>
        </div>
        {isFree && subscription && (
          <div className="mt-3 pt-3 border-t border-[#1E1E2E] text-xs text-[#8B8BA7]">
            {t("dashboard:free_plan_usage", {
              used: subscription.sessions_used ?? 0,
              total: subscription.sessions_limit ?? 1,
            })}
          </div>
        )}
      </motion.div>

      {/* Upgrade banner (FREE plan only) — visible but not aggressive */}
      {isFree && standardPriceKzt !== null && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gradient-to-r from-[#6C63FF]/10 to-[#6C63FF]/5 border border-[#6C63FF]/30 rounded-2xl p-5 mb-5"
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-[#6C63FF]" />
            <span className="text-[#F0F0FF] font-bold text-sm">{t("dashboard:upgrade_banner.title")}</span>
          </div>
          <p className="text-[#8B8BA7] text-sm">{t("dashboard:upgrade_banner.line1")}</p>
          <p className="text-[#8B8BA7] text-sm mb-4">{t("dashboard:upgrade_banner.line2")}</p>
          <button
            onClick={() => router.push("/pricing")}
            className="w-full sm:w-auto bg-[#6C63FF] hover:bg-[#7C75FF] text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            {t("dashboard:upgrade_banner.cta", { price: formatKzt(standardPriceKzt) })}
          </button>
        </motion.div>
      )}

      {/* Main content (mobile: stacks in order below; desktop: 2/3 + 1/3 sidebar) */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Risk profile */}
          {riskProfile && topRisks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[#F0F0FF] font-semibold text-sm">{t("dashboard:risk_profile")}</h2>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ color: riskColor, background: `${riskColor}18` }}
                >
                  {t(`dashboard:risk_${overallRisk}` as const)}
                </span>
              </div>
              <div className="space-y-2.5">
                <RiskCard risk={topRisks[0]} index={0} locked={!(subscription?.limits.risk_solutions ?? true)} />
                {showAllRisks &&
                  topRisks.slice(1).map((risk, i) => (
                    <RiskCard key={risk.type} risk={risk} index={i + 1} locked={!(subscription?.limits.risk_solutions ?? true)} />
                  ))}
              </div>
              {topRisks.length > 1 && (
                <button
                  onClick={() => setShowAllRisks((v) => !v)}
                  className="flex items-center gap-1 text-[#8B8BA7] hover:text-[#F0F0FF] text-xs mt-3 transition-colors"
                >
                  {showAllRisks ? (
                    <>
                      <ChevronUp size={14} />
                      {t("dashboard:hide_extra_risks")}
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} />
                      {t("dashboard:show_more_risks", { count: topRisks.length - 1 })}
                    </>
                  )}
                </button>
              )}
            </motion.div>
          )}

          {/* Modules */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-[#F0F0FF] font-semibold text-sm mb-3">{t("dashboard:modules")}</h2>
            <div className="mb-3">
              <ModuleCard
                icon={Map}
                title={t("dashboard:module_titles.roadmap")}
                subtitle={t("dashboard:continue_hint")}
                locked={false}
                href="/roadmap"
                index={0}
                featured
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {restModuleKeys.map((key, i) => (
                <ModuleCard
                  key={key}
                  icon={restModuleIcons[i]}
                  title={t(`dashboard:module_titles.${key}`)}
                  locked={false}
                  href={restModuleHrefs[i]}
                  index={i}
                />
              ))}
            </div>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="mt-5 lg:mt-0 lg:col-span-1 space-y-3">
          {/* After Visa card */}
          {afterVisa !== null && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <AfterVisaCard
                unlocked={afterVisa.unlocked && (subscription?.limits.after_visa ?? true)}
                overallPct={afterVisa.pct}
                overallCompleted={afterVisa.completed}
                overallTotal={afterVisa.total}
              />
            </motion.div>
          )}

          {/* Locked features (FREE plan only) */}
          {isFree && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42 }}
              className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5"
            >
              <h2 className="text-[#F0F0FF] font-semibold text-sm mb-3">{t("dashboard:locked_features.title")}</h2>
              <div className="space-y-2.5 mb-4">
                {(["consul_mode", "detailed_feedback", "after_visa"] as const).map((key) => (
                  <div key={key} className="flex items-center gap-2 text-sm text-[#8B8BA7]">
                    <Lock size={14} className="shrink-0" />
                    <span>{t(`dashboard:locked_features.${key}`)}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => router.push("/pricing")}
                className="w-full text-xs font-semibold text-[#6C63FF] hover:text-[#9C8BFF] transition-colors text-left"
              >
                {t("dashboard:locked_features.cta")} →
              </button>
            </motion.div>
          )}

          {/* Referral card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48 }}
          >
            <ReferralCard
              totalActive={referralStats?.totalActive ?? 0}
              nextTierNeeded={referralStats?.nextNeeded ?? undefined}
            />
          </motion.div>

          {/* Emergency card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <button
              onClick={() => router.push("/emergency")}
              className="w-full text-left bg-[#13131A] border border-[#FF6B6B]/30 rounded-2xl p-5 hover:border-[#FF6B6B]/60 hover:bg-[#1A1010] transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#FF6B6B]/15 flex items-center justify-center shrink-0">
                  <LifeBuoy size={22} className="text-[#FF6B6B]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[#FF6B6B] font-bold text-base">{t("dashboard:emergency_banner.title")}</span>
                    <span className="text-[10px] font-bold bg-[#FF6B6B]/15 text-[#FF6B6B] px-2 py-0.5 rounded-full">
                      {t("dashboard:emergency_banner.badge")}
                    </span>
                  </div>
                  <p className="text-[#8B8BA7] text-sm">
                    {t("dashboard:emergency_banner.desc")}
                  </p>
                </div>
                <span className="text-[#FF6B6B] shrink-0">›</span>
              </div>
            </button>
          </motion.div>

          {/* Profile info (collapsed by default) */}
          {profile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5"
            >
              <button
                onClick={() => setShowProfile((v) => !v)}
                className="flex items-center justify-between w-full"
              >
                <h2 className="text-[#F0F0FF] font-semibold text-sm">{t("dashboard:my_profile")}</h2>
                {showProfile ? (
                  <ChevronUp size={16} className="text-[#8B8BA7]" />
                ) : (
                  <ChevronDown size={16} className="text-[#8B8BA7]" />
                )}
              </button>
              {showProfile && (
                <div className="grid grid-cols-2 gap-3 text-xs mt-4">
                  {[
                    { label: t("dashboard:university"), value: profile.university },
                    { label: t("dashboard:course"), value: `${profile.course_year} ${t("dashboard:course_suffix")}` },
                    { label: t("dashboard:profession"), value: profile.profession },
                    { label: t("dashboard:english"), value: t(`dashboard:english_levels.${profile.english_level}` as const, { defaultValue: profile.english_level }) },
                    { label: t("dashboard:country"), value: profile.country },
                    { label: t("dashboard:job_offer"), value: t(`dashboard:job_offer_status.${profile.job_offer}` as const, { defaultValue: profile.job_offer }) },
                    { label: t("dashboard:financing"), value: t(`dashboard:financing_source.${profile.financial_source}` as const, { defaultValue: profile.financial_source }) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-[#0A0A0F] rounded-xl px-3 py-2.5">
                      <div className="text-[#8B8BA7] mb-0.5">{label}</div>
                      <div className="text-[#F0F0FF] font-medium">{value}</div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
