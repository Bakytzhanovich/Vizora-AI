"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut, ChevronDown, ChevronUp, Check, Sparkles, Map, MessageCircle, Mic, FileText, LifeBuoy, User } from "lucide-react";
import { useTranslation } from "react-i18next";

import { RiskCard } from "@/components/dashboard/RiskCard";
import { ModuleCard } from "@/components/dashboard/ModuleCard";
import { BrandedLogo } from "@/components/branding/BrandedLogo";
import { PoweredByFooter } from "@/components/branding/PoweredByFooter";
import { AfterVisaCard } from "@/components/after-visa/AfterVisaCard";
import { ReferralCard } from "@/components/referral/ReferralCard";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LogoutConfirmModal } from "@/components/ui/LogoutConfirmModal";
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
  const [standardSessionsPerMonth, setStandardSessionsPerMonth] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllRisks, setShowAllRisks] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
          if (standard) {
            setStandardPriceKzt(standard.prices_kzt.monthly);
            setStandardSessionsPerMonth(standard.limits.simulator_sessions_per_month);
          }
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
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg px-4 pt-6 pb-24 md:pb-6 max-w-5xl mx-auto">
      <PoweredByFooter />
      {/* Top nav — language/logout live on the Profile tab now; keep them here
          only on desktop, where the bottom nav (mobile-only) isn't reachable. */}
      <div className="flex items-center justify-between mb-8">
        <BrandedLogo />
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => router.push("/profile")}
            className="flex items-center gap-1.5 text-secondary hover:text-primary text-xs font-medium px-2.5 py-1.5 rounded-lg bg-border hover:bg-border-hover transition-colors"
          >
            <User size={14} />
            {t("common:nav.profile")}
          </button>
          <LanguageSwitcher />
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center gap-1.5 text-secondary hover:text-primary text-xs font-medium px-2.5 py-1.5 rounded-lg bg-border hover:bg-border-hover transition-colors"
          >
            <LogOut size={14} />
            {t("common:nav.logout")}
          </button>
        </div>
      </div>

      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-1">
          {t("dashboard:greeting", { name: profile?.name })}
        </h1>
        {daysUntilInterview !== null ? (
          <p className="text-secondary">
            {t("dashboard:interview_date", { days: daysUntilInterview })}
          </p>
        ) : (
          <p className="text-secondary">{t("dashboard:no_interview_date")}</p>
        )}
      </motion.div>

      {/* Progress */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-2xl p-5 mb-5"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-primary text-sm font-semibold">{t("dashboard:progress")}</span>
          <span className="text-accent text-sm font-bold">{journeyProgress}%</span>
        </div>
        <div className="h-2 bg-border rounded-full overflow-hidden mb-3">
          <motion.div
            className="h-full bg-gradient-to-r from-accent to-accent-light rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${journeyProgress}%` }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-teal">
          <Check size={14} />
          <span>{t("dashboard:profile_complete")}</span>
        </div>
        {isFree && subscription && (
          <div className="mt-3 pt-3 border-t border-border text-xs text-secondary">
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
          className="bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/30 rounded-2xl p-5 mb-5"
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-accent" />
            <span className="text-primary font-bold text-sm">{t("dashboard:upgrade_banner.title")}</span>
          </div>
          <p className="text-secondary text-sm">
            {t("dashboard:upgrade_banner.line1", { count: standardSessionsPerMonth ?? 15 })}
          </p>
          <p className="text-secondary text-sm mb-4">{t("dashboard:upgrade_banner.line2")}</p>
          <button
            onClick={() => router.push("/pricing")}
            className="w-full sm:w-auto bg-accent hover:bg-accent-hover text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
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
              className="bg-card border border-border rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-primary font-semibold text-sm">{t("dashboard:risk_profile")}</h2>
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
                  className="flex items-center gap-1 text-secondary hover:text-primary text-xs mt-3 transition-colors"
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

          {/* Modules — Roadmap/AI Помощник/Симулятор already have bottom-nav
              tabs on mobile, so this grid (with Documents, which doesn't)
              only needs to appear in full on desktop, where the bottom nav
              is hidden. Mobile gets a single Documents entry. */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="md:hidden">
              <ModuleCard
                icon={FileText}
                title={t("dashboard:module_titles.documents")}
                locked={false}
                href="/documents"
                index={0}
              />
            </div>
            <div className="hidden md:block">
              <h2 className="text-primary font-semibold text-sm mb-3">{t("dashboard:modules")}</h2>
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
              className="w-full text-left bg-card border border-error/30 rounded-2xl p-5 hover:border-error/60 hover:bg-error/10 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-error/15 flex items-center justify-center shrink-0">
                  <LifeBuoy size={22} className="text-error" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-error font-bold text-base">{t("dashboard:emergency_banner.title")}</span>
                    <span className="text-[10px] font-bold bg-error/15 text-error px-2 py-0.5 rounded-full">
                      {t("dashboard:emergency_banner.badge")}
                    </span>
                  </div>
                  <p className="text-secondary text-sm">
                    {t("dashboard:emergency_banner.desc")}
                  </p>
                </div>
                <span className="text-error shrink-0">›</span>
              </div>
            </button>
          </motion.div>
        </div>
      </div>

      {showLogoutConfirm && (
        <LogoutConfirmModal
          onConfirm={logout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </div>
  );
}
