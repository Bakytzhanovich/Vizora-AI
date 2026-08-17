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
  critical: { bg: "bg-error/10 border-error/40", text: "text-error" },
  high: { bg: "bg-warning/10 border-warning/40", text: "text-warning" },
  medium: { bg: "bg-accent/10 border-accent/40", text: "text-accent" },
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
        <div className="flex items-center gap-2 text-sm text-secondary mb-2">
          <span>{scenarioIcon}</span>
          <span>{scenarioTitle}</span>
        </div>
        <h2 className="text-primary text-2xl font-bold">{t("action_plan")}</h2>
      </div>

      {/* Urgency banner */}
      <div className={`border rounded-xl px-4 py-3 ${banner.bg}`}>
        <p className={`font-bold text-sm ${banner.text}`}>{bannerLabel}</p>
      </div>

      {/* Steps */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="text-primary font-semibold text-sm mb-3">{t("steps_order")}</h3>
        <ol className="flex flex-col gap-3">
          {plan.steps.map((step, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex gap-3 text-sm text-secondary leading-relaxed"
            >
              <span className="shrink-0 w-5 h-5 rounded-full bg-error/15 text-error text-[10px] font-bold flex items-center justify-center mt-0.5">
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
          className="flex items-center gap-2 text-primary font-semibold text-sm mb-3"
        >
          <span>📞 {t("contacts")}</span>
          <span className="text-secondary">{showContacts ? "▲" : "▼"}</span>
        </button>
        {showContacts && <ContactsList contacts={plan.contacts} />}
      </div>

      {/* Disclaimer */}
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <p className="text-secondary text-xs leading-relaxed">{plan.disclaimer}</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 pb-2">
        <button
          onClick={() => router.push("/chat")}
          className="w-full py-4 rounded-2xl border border-accent/40 text-accent font-semibold text-sm hover:bg-accent/10 transition-colors"
        >
          {t("ask_ai")}
        </button>
        <button
          onClick={onResolve}
          disabled={resolving}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal to-[#00B894] text-bg font-bold text-sm transition-opacity disabled:opacity-60"
        >
          {resolving ? t("resolving") : t("resolved")}
        </button>
      </div>
    </motion.div>
  );
}
