"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Lock } from "lucide-react";
import type { RiskItem } from "@/lib/api";

const severityConfig = {
  high: { color: "#FF6B6B", bg: "bg-[#FF6B6B]/10", border: "border-[#FF6B6B]/20", key: "risk_high" },
  medium: { color: "#F59E0B", bg: "bg-[#F59E0B]/10", border: "border-[#F59E0B]/20", key: "risk_medium" },
  low: { color: "#00D4AA", bg: "bg-[#00D4AA]/10", border: "border-[#00D4AA]/20", key: "risk_low" },
};

interface Props {
  risk: RiskItem;
  index: number;
  /** true when the plan's risk_solutions limit is off (FREE) — the risk
   * itself still shows, but the "how to fix" advice is gated behind upgrade. */
  locked?: boolean;
}

export function RiskCard({ risk, index, locked = false }: Props) {
  const router = useRouter();
  const { t } = useTranslation("dashboard");
  const cfg = severityConfig[risk.severity];

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 * index }}
      className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border ${cfg.bg} ${cfg.border}`}
    >
      <AlertTriangle size={18} className="mt-0.5 shrink-0" style={{ color: cfg.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-[#F0F0FF] text-sm font-semibold">{risk.label_ru}</span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ color: cfg.color, background: `${cfg.color}18` }}
          >
            {t(cfg.key)}
          </span>
        </div>

        {!locked ? (
          <p className="text-[#8B8BA7] text-xs leading-relaxed">{risk.advice_ru}</p>
        ) : (
          <div>
            <p className="text-[#8B8BA7] text-xs mb-1">{t("how_to_fix")}</p>
            {/* Placeholder blocks, not risk.advice_ru — a CSS blur alone
                would still ship the real gated text in the DOM, readable via
                devtools/view-source regardless of the visual filter. */}
            <p
              aria-hidden="true"
              className="text-[#8B8BA7] text-xs leading-relaxed blur-[4px] select-none pointer-events-none"
            >
              ▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓ ▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓
            </p>
            <button
              onClick={() => router.push("/pricing")}
              className="text-[#6C63FF] text-xs font-semibold flex items-center gap-1 hover:text-[#9C8BFF] transition-colors mt-1.5"
            >
              <Lock size={11} /> {t("unlock_solutions")}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
