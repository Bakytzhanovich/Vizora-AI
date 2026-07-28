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
      <div className="w-full bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5 opacity-60">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔒</span>
          <div>
            <p className="text-[#F0F0FF] font-semibold text-sm">{t("after_visa_card.locked_title")}</p>
            <p className="text-[#8B8BA7] text-xs mt-0.5">
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
      className="w-full text-left bg-gradient-to-r from-[#00D4AA]/10 to-[#00B894]/5 border border-[#00D4AA]/30 rounded-2xl p-5 hover:border-[#00D4AA]/60 transition-all active:scale-[0.98]"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">🎉</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#00D4AA] font-bold text-base">{t("after_visa_card.title")}</span>
            <span className="text-[10px] font-bold bg-[#00D4AA]/15 text-[#00D4AA] px-2 py-0.5 rounded-full">
              {t("after_visa_card.unlocked_badge")}
            </span>
          </div>
          <p className="text-[#8B8BA7] text-sm mb-3">
            {t("after_visa_card.desc")}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[#1E1E2E] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#00D4AA] rounded-full transition-all"
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <span className="text-[#8B8BA7] text-xs shrink-0">
              {overallCompleted}/{overallTotal}
            </span>
          </div>
        </div>
        <span className="text-[#00D4AA] shrink-0 mt-1">›</span>
      </div>
    </motion.button>
  );
}
