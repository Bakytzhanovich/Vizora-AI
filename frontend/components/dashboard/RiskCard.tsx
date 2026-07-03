"use client";

import { motion } from "framer-motion";
import type { RiskItem } from "@/lib/api";

const severityConfig = {
  high: { color: "#FF6B6B", bg: "bg-[#FF6B6B]/10", border: "border-[#FF6B6B]/20", label: "Высокий риск" },
  medium: { color: "#F59E0B", bg: "bg-[#F59E0B]/10", border: "border-[#F59E0B]/20", label: "Средний риск" },
  low: { color: "#00D4AA", bg: "bg-[#00D4AA]/10", border: "border-[#00D4AA]/20", label: "Низкий риск" },
};

interface Props {
  risk: RiskItem;
  index: number;
}

export function RiskCard({ risk, index }: Props) {
  const cfg = severityConfig[risk.severity];
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 * index }}
      className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border ${cfg.bg} ${cfg.border}`}
    >
      <span className="text-lg mt-0.5 shrink-0">⚠️</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-[#F0F0FF] text-sm font-semibold">{risk.label_ru}</span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ color: cfg.color, background: `${cfg.color}18` }}
          >
            {cfg.label}
          </span>
        </div>
        <p className="text-[#8B8BA7] text-xs leading-relaxed">{risk.advice_ru}</p>
      </div>
    </motion.div>
  );
}
