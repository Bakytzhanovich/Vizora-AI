"use client";

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

export type OfficerDecision = "approved" | "processing" | "refused";

export const OFFICER_DECISIONS: readonly OfficerDecision[] = ["approved", "processing", "refused"];

const DECISION_STYLES: Record<OfficerDecision, { emoji: string; bg: string; border: string; text: string }> = {
  approved: { emoji: "🎉", bg: "bg-teal/10", border: "border-teal/30", text: "text-teal" },
  processing: { emoji: "⏳", bg: "bg-warning/10", border: "border-warning/30", text: "text-warning" },
  refused: { emoji: "🛑", bg: "bg-error/10", border: "border-error/30", text: "text-error" },
};

export function isOfficerDecision(value: unknown): value is OfficerDecision {
  return typeof value === "string" && (OFFICER_DECISIONS as readonly string[]).includes(value);
}

// The decision the consul announced at the end of the interview — shown as an
// overlay the moment it's spoken, and again at the top of the results screen.
export function OfficerDecisionCard({ decision }: { decision: OfficerDecision }) {
  const { t } = useTranslation("simulator");
  const style = DECISION_STYLES[decision];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={`border rounded-2xl px-6 py-8 flex flex-col items-center text-center ${style.bg} ${style.border}`}
    >
      <div className="text-5xl mb-3">{style.emoji}</div>
      <p className="text-secondary text-xs font-semibold uppercase tracking-wide mb-1">
        {t("decision.caption")}
      </p>
      <h2 className={`text-2xl font-bold mb-2 ${style.text}`}>{t(`decision.${decision}.title`)}</h2>
      <p className="text-secondary text-sm leading-relaxed max-w-sm">{t(`decision.${decision}.subtitle`)}</p>
    </motion.div>
  );
}
