"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

interface AfterVisaCardProps {
  unlocked: boolean;
  overallPct?: number;
  overallCompleted?: number;
  overallTotal?: number;
}

export function AfterVisaCard({
  unlocked,
  overallPct = 0,
  overallCompleted = 0,
  overallTotal = 0,
}: AfterVisaCardProps) {
  const router = useRouter();
  const { t } = useTranslation("dashboard");

  if (!unlocked) {
    return (
      <div className="w-full bg-card border border-border rounded-2xl p-5 opacity-60">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔒</span>
          <div>
            <p className="text-primary font-semibold text-sm">{t("after_visa_card.locked_title")}</p>
            <p className="text-secondary text-xs mt-0.5">
              {t("after_visa_card.locked_desc")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => router.push("/after-visa")}
      className="w-full text-left bg-gradient-to-r from-teal/10 to-[#00B894]/5 border border-teal/30 rounded-2xl p-5 hover:border-teal/60 transition-all active:scale-[0.98]"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">🎉</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-teal font-bold text-base">{t("after_visa_card.title")}</span>
            <span className="text-[10px] font-bold bg-teal/15 text-teal px-2 py-0.5 rounded-full">
              {t("after_visa_card.unlocked_badge")}
            </span>
          </div>
          <p className="text-secondary text-sm mb-3">
            {t("after_visa_card.desc")}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-teal rounded-full transition-all"
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <span className="text-secondary text-xs shrink-0">
              {overallCompleted}/{overallTotal}
            </span>
          </div>
        </div>
        <span className="text-teal shrink-0 mt-1">›</span>
      </div>
    </motion.button>
  );
}
