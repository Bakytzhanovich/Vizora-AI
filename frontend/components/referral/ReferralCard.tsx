"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Gift } from "lucide-react";

interface ReferralCardProps {
  totalActive?: number;
  nextTierNeeded?: number;
}

export function ReferralCard({ totalActive = 0, nextTierNeeded }: ReferralCardProps) {
  const router = useRouter();
  const { t } = useTranslation("dashboard");

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => router.push("/referral")}
      className="w-full text-left bg-card border border-border rounded-2xl p-4 hover:border-accent/40 transition-all active:scale-[0.98]"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 flex items-center justify-center shrink-0">
          <Gift size={20} strokeWidth={1.75} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-primary font-semibold text-sm">{t("referral_card.title")}</span>
            {totalActive > 0 && (
              <span className="text-[10px] font-bold bg-warning/15 text-warning px-2 py-0.5 rounded-full">
                {totalActive} {totalActive > 1 ? t("referral_card.friend_plural") : t("referral_card.friend_singular")}
              </span>
            )}
          </div>
          <p className="text-secondary text-xs">
            {nextTierNeeded != null && nextTierNeeded > 0
              ? t("referral_card.next_tier", { count: nextTierNeeded })
              : t("referral_card.default_hint")}
          </p>
        </div>
        <span className="text-accent shrink-0">›</span>
      </div>
    </motion.button>
  );
}
