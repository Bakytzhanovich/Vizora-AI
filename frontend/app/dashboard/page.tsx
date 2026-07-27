"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";

import { RiskCard } from "@/components/dashboard/RiskCard";
import { ModuleCard } from "@/components/dashboard/ModuleCard";
import { BrandedLogo } from "@/components/branding/BrandedLogo";
import { PoweredByFooter } from "@/components/branding/PoweredByFooter";
import { AfterVisaCard } from "@/components/after-visa/AfterVisaCard";
import { ReferralCard } from "@/components/referral/ReferralCard";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PlanBadge } from "@/components/PlanBadge";
import { apiGetMe, apiGetRoadmap, apiGetAfterVisaModules, apiGetReferralCode } from "@/lib/api";
import type { UserProfile, RiskProfile, SubscriptionInfo } from "@/lib/api";

const moduleHrefs = ["/chat", "/simulator", "/documents", "/roadmap"] as const;
const moduleIcons = ["🤖", "🎤", "📄", "🗺️"];
const moduleKeys = ["chat", "simulator", "documents", "roadmap"] as const;

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
  const [loading, setLoading] = useState(true);

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
    ])
      .then(([me, roadmap, av, ref]) => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#6C63FF]/30 border-t-[#6C63FF] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 py-6 max-w-2xl mx-auto">
      <PoweredByFooter />
      {/* Top nav */}
      <div className="flex items-center justify-between mb-8">
        <BrandedLogo />
        <div className="flex items-center gap-3">
          <PlanBadge subscription={subscription} />
          <LanguageSwitcher />
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-[#8B8BA7] hover:text-[#F0F0FF] text-sm transition-colors"
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
        <h1 className="text-2xl sm:text-3xl font-bold text-[#F0F0FF] mb-1">
          {t("dashboard:greeting", { name: profile?.name })} 👋
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
          <span>✓</span>
          <span>{t("dashboard:profile_complete")}</span>
        </div>
      </motion.div>

      {/* Risk profile */}
      {riskProfile && topRisks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5 mb-5"
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
            {topRisks.map((risk, i) => (
              <RiskCard key={risk.type} risk={risk} index={i} />
            ))}
          </div>
          {topRisks.length === 0 && (
            <p className="text-[#8B8BA7] text-sm text-center py-2">
              {t("dashboard:no_risks")}
            </p>
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
        <div className="grid grid-cols-2 gap-3">
          {moduleKeys.map((key, i) => (
            <ModuleCard
              key={key}
              icon={moduleIcons[i]}
              title={t(`dashboard:module_titles.${key}`)}
              locked={false}
              href={moduleHrefs[i]}
              index={i}
            />
          ))}
        </div>
      </motion.div>

      {/* After Visa card */}
      {afterVisa !== null && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-5"
        >
          <AfterVisaCard
            unlocked={afterVisa.unlocked}
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
        className="mt-3"
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
        className="mt-5"
      >
        <button
          onClick={() => router.push("/emergency")}
          className="w-full text-left bg-[#13131A] border border-[#FF6B6B]/30 rounded-2xl p-5 hover:border-[#FF6B6B]/60 hover:bg-[#1A1010] transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-4">
            <div className="text-3xl shrink-0">🆘</div>
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

      {/* Profile info */}
      {profile && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-5 bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5"
        >
          <h2 className="text-[#F0F0FF] font-semibold text-sm mb-3">{t("dashboard:my_profile")}</h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { label: t("dashboard:university"), value: profile.university },
              { label: t("dashboard:course"), value: `${profile.course_year} ${t("dashboard:course_suffix")}` },
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
        </motion.div>
      )}
    </div>
  );
}
