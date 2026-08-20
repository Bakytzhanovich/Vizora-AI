"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Check, LogOut, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/hooks/useAuth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LogoutConfirmModal } from "@/components/ui/LogoutConfirmModal";
import { PoweredByFooter } from "@/components/branding/PoweredByFooter";
import { apiGetPlans } from "@/lib/api";
import { formatDate } from "@/lib/format";

function formatKzt(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount) + " ₸/мес";
}

export default function ProfilePage() {
  const router = useRouter();
  const { t, i18n } = useTranslation(["profile", "common", "dashboard", "pricing"]);
  const dateLocale = i18n.language === "kz" ? "kk-KZ" : "ru-RU";
  const { user, profile, subscription, isAuthenticated, isLoading, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [standardPriceKzt, setStandardPriceKzt] = useState<number | null>(null);
  const [standardSessionsPerMonth, setStandardSessionsPerMonth] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (subscription?.plan === "free") {
      apiGetPlans()
        .then((res) => {
          const standard = res.plans.find((p) => p.id === "standard");
          if (standard) {
            setStandardPriceKzt(standard.prices_kzt.monthly);
            setStandardSessionsPerMonth(standard.limits.simulator_sessions_per_month);
          }
        })
        .catch(() => {});
    }
  }, [subscription?.plan]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const isFree = subscription?.plan === "free";
  const initial = (profile?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  const details = profile
    ? [
        { label: t("dashboard:university"), value: profile.university },
        { label: t("dashboard:course"), value: `${profile.course_year} ${t("dashboard:course_suffix")}` },
        { label: t("dashboard:profession"), value: profile.profession },
        {
          label: t("dashboard:english"),
          value: t(`dashboard:english_levels.${profile.english_level}` as const, { defaultValue: profile.english_level }),
        },
        { label: t("dashboard:country"), value: profile.country },
        {
          label: t("dashboard:job_offer"),
          value: t(`dashboard:job_offer_status.${profile.job_offer}` as const, { defaultValue: profile.job_offer }),
        },
        {
          label: t("dashboard:financing"),
          value: t(`dashboard:financing_source.${profile.financial_source}` as const, { defaultValue: profile.financial_source }),
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-bg">
      <PoweredByFooter />
      {/* Header */}
      <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-primary font-bold leading-tight">{t("profile:title")}</h1>
            <p className="text-secondary text-xs">{t("profile:subtitle")}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 lg:pb-6 flex flex-col gap-5">
        {/* Account card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4"
        >
          <div className="w-14 h-14 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-xl font-bold text-accent shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="text-primary font-semibold truncate">{profile?.name || user?.email}</div>
            <div className="text-secondary text-sm truncate">{user?.email}</div>
          </div>
        </motion.div>

        {/* Subscription — plan name leads as the card's main heading (not a
            small corner badge) so it's unmistakable at a glance; paid plans
            get an accent-tinted card to visually read as "you have something". */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`rounded-2xl p-5 border ${
            isFree ? "bg-card border-border" : "bg-gradient-to-r from-accent/10 to-accent/5 border-accent/30"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-secondary text-xs font-semibold uppercase tracking-wide">
              {t("profile:current_plan")}
            </span>
            {!isFree && (
              <span className="flex items-center gap-1 text-xs font-semibold text-teal">
                <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                {t("profile:status_active")}
              </span>
            )}
          </div>
          <h2 className={`text-2xl font-bold mb-3 ${isFree ? "text-primary" : "text-accent-light"}`}>
            {t(`pricing:plan_names.${subscription?.plan ?? "free"}` as const, { defaultValue: subscription?.plan })}
          </h2>
          {isFree ? (
            <>
              <p className="text-secondary text-sm">
                {t("dashboard:free_plan_usage", {
                  used: subscription?.sessions_used ?? 0,
                  total: subscription?.sessions_limit ?? 1,
                })}
              </p>
              {standardPriceKzt !== null && (
                <>
                  <ul className="mt-3 space-y-1">
                    {(["line1", "line2"] as const).map((key) => (
                      <li key={key} className="flex items-start gap-1.5 text-secondary text-xs">
                        <Check size={13} className="text-teal shrink-0 mt-0.5" />
                        {t(`dashboard:upgrade_banner.${key}`, { count: standardSessionsPerMonth ?? 15 })}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => router.push("/pricing")}
                    className="w-full mt-4 bg-accent hover:bg-accent-hover text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Sparkles size={15} />
                    {t("dashboard:upgrade_banner.cta", { price: formatKzt(standardPriceKzt) })}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <p className="text-secondary text-sm">
                {subscription?.sessions_limit != null
                  ? t("profile:sessions_usage", { used: subscription.sessions_used ?? 0, total: subscription.sessions_limit })
                  : t("profile:sessions_unlimited")}
              </p>
              {subscription?.period_end && (
                <p className="text-secondary text-sm">
                  {t("profile:renews_on", { date: formatDate(subscription.period_end, dateLocale) })}
                </p>
              )}
              <button
                onClick={() => router.push("/pricing")}
                className="text-accent hover:text-accent-light text-sm font-semibold mt-3 transition-colors"
              >
                {t("profile:manage_subscription")}
              </button>
            </>
          )}
        </motion.div>

        {/* About me */}
        {details.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-2xl p-5"
          >
            <h2 className="text-primary font-semibold text-sm mb-4">{t("profile:about_me")}</h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {details.map(({ label, value }) => (
                <div key={label} className="bg-bg rounded-xl px-3 py-2.5">
                  <div className="text-secondary mb-0.5">{label}</div>
                  <div className="text-primary font-medium">{value}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Language & theme */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-primary font-semibold text-sm">{t("profile:language")}</h2>
            <LanguageSwitcher />
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <h2 className="text-primary font-semibold text-sm">{t("profile:theme")}</h2>
            <ThemeSwitcher />
          </div>
        </motion.div>

        {/* Logout */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center justify-center gap-2 text-error font-semibold text-sm py-3.5 rounded-xl border border-error/20 hover:bg-error/10 transition-colors"
        >
          <LogOut size={16} />
          {t("common:nav.logout")}
        </motion.button>
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
