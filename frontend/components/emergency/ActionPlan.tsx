"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { EmergencyActionPlan } from "@/lib/api";
import { ContactsList } from "./ContactsList";

interface ActionPlanProps {
  plan: EmergencyActionPlan;
  scenarioTitle: string;
  scenarioIcon: string;
  onResolve: () => void;
  resolving?: boolean;
}

const urgencyBannerStyle: Record<string, { bg: string; text: string }> = {
  critical: { bg: "bg-[#FF6B6B]/10 border-[#FF6B6B]/40", text: "text-[#FF6B6B]" },
  high: { bg: "bg-[#F59E0B]/10 border-[#F59E0B]/40", text: "text-[#F59E0B]" },
  medium: { bg: "bg-[#6C63FF]/10 border-[#6C63FF]/40", text: "text-[#6C63FF]" },
};

export function ActionPlan({
  plan,
  scenarioTitle,
  scenarioIcon,
  onResolve,
  resolving,
}: ActionPlanProps) {
  const { t } = useTranslation("emergency");
  const router = useRouter();
  const [showContacts, setShowContacts] = useState(true);
  const banner = urgencyBannerStyle[plan.urgency] ?? urgencyBannerStyle.medium;
  const bannerLabel = t(`urgency_banner.${plan.urgency}` as const, { defaultValue: t("urgency_banner.medium") });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-5"
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-[#8B8BA7] mb-2">
          <span>{scenarioIcon}</span>
          <span>{scenarioTitle}</span>
        </div>
        <h2 className="text-[#F0F0FF] text-2xl font-bold">{t("action_plan")}</h2>
      </div>

      {/* Urgency banner */}
      <div className={`border rounded-xl px-4 py-3 ${banner.bg}`}>
        <p className={`font-bold text-sm ${banner.text}`}>{bannerLabel}</p>
      </div>

      {/* Steps */}
      <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-4">
        <h3 className="text-[#F0F0FF] font-semibold text-sm mb-3">{t("steps_order")}</h3>
        <ol className="flex flex-col gap-3">
          {plan.steps.map((step, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex gap-3 text-sm text-[#E0E0F0] leading-relaxed"
            >
              <span className="shrink-0 w-5 h-5 rounded-full bg-[#FF6B6B]/15 text-[#FF6B6B] text-[10px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span>{step}</span>
            </motion.li>
          ))}
        </ol>
      </div>

      {/* Contacts */}
      <div>
        <button
          onClick={() => setShowContacts((v) => !v)}
          className="flex items-center gap-2 text-[#F0F0FF] font-semibold text-sm mb-3"
        >
          <span>📞 {t("contacts")}</span>
          <span className="text-[#8B8BA7]">{showContacts ? "▲" : "▼"}</span>
        </button>
        {showContacts && <ContactsList contacts={plan.contacts} />}
      </div>

      {/* Disclaimer */}
      <div className="bg-[#13131A] border border-[#1E1E2E] rounded-xl px-4 py-3">
        <p className="text-[#8B8BA7] text-xs leading-relaxed">{plan.disclaimer}</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 pb-2">
        <button
          onClick={() => router.push("/chat")}
          className="w-full py-4 rounded-2xl border border-[#6C63FF]/40 text-[#6C63FF] font-semibold text-sm hover:bg-[#6C63FF]/10 transition-colors"
        >
          {t("ask_ai")}
        </button>
        <button
          onClick={onResolve}
          disabled={resolving}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#00D4AA] to-[#00B894] text-[#0A0A0F] font-bold text-sm transition-opacity disabled:opacity-60"
        >
          {resolving ? t("resolving") : t("resolved")}
        </button>
      </div>
    </motion.div>
  );
}
