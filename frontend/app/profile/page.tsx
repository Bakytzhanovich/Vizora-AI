"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, LogOut, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/hooks/useAuth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LogoutConfirmModal } from "@/components/ui/LogoutConfirmModal";
import { PoweredByFooter } from "@/components/branding/PoweredByFooter";
import { apiGetPlans } from "@/lib/api";

function formatKzt(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount) + " ₸/мес";
}

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useTranslation(["profile", "common", "dashboard", "pricing"]);
  const { user, profile, subscription, isAuthenticated, isLoading, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [standardPriceKzt, setStandardPriceKzt] = useState<number | null>(null);

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
          if (standard) setStandardPriceKzt(standard.prices_kzt.monthly);
        })
        .catch(() => {});
    }
  }, [subscription?.plan]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#6C63FF]/30 border-t-[#6C63FF] rounded-full animate-spin" />
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
    <div className="min-h-screen bg-[#0A0A0F]">
      <PoweredByFooter />
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur border-b border-[#1E1E2E]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-[#8B8BA7] hover:text-[#F0F0FF] transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-[#F0F0FF] font-bold leading-tight">{t("profile:title")}</h1>
            <p className="text-[#8B8BA7] text-xs">{t("profile:subtitle")}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-6 flex flex-col gap-5">
        {/* Account card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5 flex items-center gap-4"
        >
          <div className="w-14 h-14 rounded-full bg-[#6C63FF]/15 border border-[#6C63FF]/30 flex items-center justify-center text-xl font-bold text-[#6C63FF] shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="text-[#F0F0FF] font-semibold truncate">{profile?.name || user?.email}</div>
            <div className="text-[#8B8BA7] text-sm truncate">{user?.email}</div>
          </div>
        </motion.div>

        {/* Subscription */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[#F0F0FF] font-semibold text-sm">{t("profile:subscription")}</h2>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#6C63FF]/15 text-[#9C8BFF]">
              {t(`pricing:plan_names.${subscription?.plan ?? "free"}` as const, { defaultValue: subscription?.plan })}
            </span>
          </div>
          {isFree ? (
            <>
              <p className="text-[#8B8BA7] text-sm mt-2">
                {t("dashboard:free_plan_usage", {
                  used: subscription?.sessions_used ?? 0,
                  total: subscription?.sessions_limit ?? 1,
                })}
              </p>
              {standardPriceKzt !== null && (
                <button
                  onClick={() => router.push("/pricing")}
                  className="w-full mt-4 bg-[#6C63FF] hover:bg-[#7C75FF] text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Sparkles size={15} />
                  {t("dashboard:upgrade_banner.cta", { price: formatKzt(standardPriceKzt) })}
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => router.push("/pricing")}
              className="text-[#6C63FF] hover:text-[#9C8BFF] text-sm font-semibold mt-2 transition-colors"
            >
              {t("profile:manage_subscription")}
            </button>
          )}
        </motion.div>

        {/* About me */}
        {details.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5"
          >
            <h2 className="text-[#F0F0FF] font-semibold text-sm mb-4">{t("profile:about_me")}</h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {details.map(({ label, value }) => (
                <div key={label} className="bg-[#0A0A0F] rounded-xl px-3 py-2.5">
                  <div className="text-[#8B8BA7] mb-0.5">{label}</div>
                  <div className="text-[#F0F0FF] font-medium">{value}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Language */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5 flex items-center justify-between"
        >
          <h2 className="text-[#F0F0FF] font-semibold text-sm">{t("profile:language")}</h2>
          <LanguageSwitcher />
        </motion.div>

        {/* Logout */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center justify-center gap-2 text-[#FF6B6B] font-semibold text-sm py-3.5 rounded-xl border border-[#FF6B6B]/20 hover:bg-[#FF6B6B]/10 transition-colors"
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
