"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut, ChevronDown, AlertTriangle, Sparkles, MessageCircle, Mic, FileText, Gift, LifeBuoy, User } from "lucide-react";
import { useTranslation } from "react-i18next";

import { RiskCard } from "@/components/dashboard/RiskCard";
import { ModuleCard } from "@/components/dashboard/ModuleCard";
import { PrepActionCard } from "@/components/dashboard/PrepActionCard";
import { BrandedLogo } from "@/components/branding/BrandedLogo";
import { PoweredByFooter } from "@/components/branding/PoweredByFooter";
import { AfterVisaCard } from "@/components/after-visa/AfterVisaCard";
import { ReferralCard } from "@/components/referral/ReferralCard";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
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
  const [riskExpanded, setRiskExpanded] = useState(false);
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
    <div className="min-h-screen bg-bg px-4 pt-6 pb-24 lg:pb-6 max-w-5xl mx-auto">
      <PoweredByFooter />
      {/* Top nav — hidden at lg+, where the sidebar (logo, profile, language,
          logout) takes over; kept for mobile/tablet, where the sidebar is hidden.
          The controls group carries its own ml-auto, so it hugs the right edge
          whether it sits next to the logo (most widths) or wraps to its own
          line (narrow phones like iPhone SE) — no hardcoded breakpoint to get
          wrong, flexbox just does the right thing at every width. */}
      <div className="flex items-center flex-wrap gap-y-2 mb-8 lg:hidden">
        <BrandedLogo />
        <div className="flex items-center flex-wrap justify-end gap-2 ml-auto">
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => router.push("/profile")}
              className="flex items-center gap-1.5 text-secondary hover:text-primary text-xs font-medium px-2.5 py-1.5 rounded-lg bg-border hover:bg-border-hover transition-colors"
            >
              <User size={14} />
              {t("common:nav.profile")}
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-1.5 text-secondary hover:text-primary text-xs font-medium px-2.5 py-1.5 rounded-lg bg-border hover:bg-border-hover transition-colors"
            >
              <LogOut size={14} />
              {t("common:nav.logout")}
            </button>
          </div>
          <LanguageSwitcher />
          <ThemeSwitcher />
          <button
            onClick={() => setShowLogoutConfirm(true)}
            aria-label={t("common:nav.logout")}
            className="md:hidden p-2 rounded-lg bg-border hover:bg-border-hover text-secondary hover:text-primary transition-colors"
          >
            <LogOut size={16} />
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

      {/* Main content (mobile: stacks in order below; desktop: 2/3 + 1/3 sidebar) */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-3">
          {/* Merged progress + "continue roadmap" — was two cards saying the
              same thing two ways (a % bar, then a separate "continue" card
              right below it). One card, one primary action, gets the only
              real visual elevation on the screen. */}
          <PrepActionCard progress={journeyProgress} href="/roadmap" />
          {isFree && subscription && (
            <p className="text-secondary text-xs px-1 -mt-1">
              {t("dashboard:free_plan_usage", {
                used: subscription.sessions_used ?? 0,
                total: subscription.sessions_limit ?? 1,
              })}
            </p>
          )}

          {/* Risk profile — collapsed to one row by default. Reading the
              first risk's full advice (or the locked-upsell prompt) isn't
              what a returning user needs at a glance; tapping to open it is
              a deliberate second step, not something shipped expanded. */}
          {riskProfile && topRisks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-card border border-border rounded-2xl p-4"
            >
              <button
                onClick={() => setRiskExpanded((v) => !v)}
                aria-expanded={riskExpanded}
                className="w-full flex items-center gap-3 text-left"
              >
                <span
                  className="w-8 h-8 rounded-[10px] border flex items-center justify-center shrink-0"
                  style={{ color: riskColor, background: `${riskColor}1E`, borderColor: `${riskColor}40` }}
                >
                  <AlertTriangle size={15} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-primary text-sm font-semibold">{t("dashboard:risk_profile")}</span>
                  <span className="text-xs font-medium" style={{ color: riskColor }}>
                    {t("dashboard:risk_summary", {
                      level: t(`dashboard:risk_${overallRisk}` as const),
                      count: topRisks.length,
                    })}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  className={`text-secondary shrink-0 transition-transform duration-200 ${riskExpanded ? "rotate-180" : ""}`}
                />
              </button>

              {riskExpanded && (
                <div className="mt-4 pt-4 border-t border-border">
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
                      <ChevronDown size={14} className={showAllRisks ? "rotate-180" : ""} />
                      {showAllRisks ? t("dashboard:hide_extra_risks") : t("dashboard:show_more_risks", { count: topRisks.length - 1 })}
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Upgrade nudge (FREE plan only) — a slim row, not a bordered
              card with its own heading and two lines of body copy. This is
              the first thing a not-yet-paying user sees on every visit;
              keeping it low-key matters more here than on a one-time
              onboarding screen. */}
          {isFree && standardPriceKzt !== null && (
            <motion.button
              onClick={() => router.push("/pricing")}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="w-full flex items-center gap-2.5 bg-card border border-border hover:border-accent/40 rounded-xl px-3.5 py-2.5 text-left transition-colors"
            >
              <Sparkles size={15} className="text-accent-light shrink-0" />
              <span className="flex-1 min-w-0 text-xs text-secondary leading-tight">
                <span className="text-primary font-semibold">{t("dashboard:upgrade_slim.prefix")}</span>{" "}
                {t("dashboard:upgrade_slim.text", { count: standardSessionsPerMonth ?? 15 })}
              </span>
              <span className="text-accent-light text-xs font-bold shrink-0">
                {t("dashboard:upgrade_slim.cta", { price: formatKzt(standardPriceKzt) })}
              </span>
            </motion.button>
          )}

          {/* Modules — Roadmap now leads the page above, and AI Помощник/
              Симулятор already have bottom-nav tabs on mobile, so this grid
              (with Documents, which doesn't) only needs to appear in full on
              desktop, where the bottom nav is hidden. Mobile gets Documents
              grouped with Referral below as a lighter, borderless-row list —
              full bordered cards for every secondary/utility link reads as
              one long wall of same-weight boxes; only genuinely actionable
              cards (Roadmap, Risk, Upgrade, Emergency) keep the heavier
              treatment. */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="md:hidden bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden"
          >
            <button
              onClick={() => router.push("/documents")}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-border/40 transition-colors"
            >
              <span className="w-7 h-7 rounded-lg bg-border flex items-center justify-center shrink-0">
                <FileText size={15} className="text-secondary" />
              </span>
              <span className="flex-1 text-primary text-sm font-medium">{t("dashboard:documents_list_label")}</span>
              <span className="text-secondary shrink-0">›</span>
            </button>
            <button
              onClick={() => router.push("/referral")}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-border/40 transition-colors"
            >
              <span className="w-7 h-7 rounded-lg bg-border flex items-center justify-center shrink-0">
                <Gift size={15} className="text-secondary" />
              </span>
              <span className="flex-1 text-primary text-sm font-medium">{t("dashboard:referral_card.title")}</span>
              {(referralStats?.totalActive ?? 0) > 0 && (
                <span className="text-[10px] font-bold bg-warning/15 text-warning px-2 py-0.5 rounded-full">
                  {referralStats!.totalActive}{" "}
                  {referralStats!.totalActive > 1 ? t("dashboard:referral_card.friend_plural") : t("dashboard:referral_card.friend_singular")}
                </span>
              )}
              <span className="text-secondary shrink-0">›</span>
            </button>
            <button
              onClick={() => router.push("/emergency")}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-border/40 transition-colors"
            >
              <span className="w-7 h-7 rounded-lg bg-error/10 flex items-center justify-center shrink-0">
                <LifeBuoy size={15} className="text-error" />
              </span>
              <span className="flex-1 text-primary text-sm font-medium">{t("dashboard:emergency_list_label")}</span>
              <span className="text-secondary shrink-0">›</span>
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
          >
            <div className="hidden md:block">
              <h2 className="text-primary font-semibold text-sm mb-3">{t("dashboard:modules")}</h2>
              <div className="grid grid-cols-3 gap-3">
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

          {/* Referral card — hidden below md, where it's already covered by
              the lighter Documents+Referral list above the sidebar. */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48 }}
            className="hidden md:block"
          >
            <ReferralCard
              totalActive={referralStats?.totalActive ?? 0}
              nextTierNeeded={referralStats?.nextNeeded ?? undefined}
            />
          </motion.div>

          {/* Emergency card — desktop sidebar only below md; the mobile
              util-list above already has a compact Emergency row, a full
              card there would duplicate it. */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="hidden md:block"
          >
            <button
              onClick={() => router.push("/emergency")}
              className="w-full text-left bg-card border border-error/30 rounded-2xl p-5 hover:border-error/60 hover:bg-error/10 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 flex items-center justify-center shrink-0">
                  <LifeBuoy size={24} strokeWidth={1.75} className="text-error" />
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
