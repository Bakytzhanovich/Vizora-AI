"use client";

import { motion } from "framer-motion";
import type { EmergencyScenario } from "@/lib/api";

interface ScenarioCardProps {
  scenario: EmergencyScenario;
  index: number;
  onClick: (id: string) => void;
  loading?: boolean;
}

const urgencyBorder: Record<string, string> = {
  critical: "border-[#FF6B6B]/40 hover:border-[#FF6B6B]",
  high: "border-[#F59E0B]/30 hover:border-[#F59E0B]",
  medium: "border-[#1E1E2E] hover:border-[#F59E0B]/50",
};

const urgencyDot: Record<string, string> = {
  critical: "bg-[#FF6B6B]",
  high: "bg-[#F59E0B]",
  medium: "bg-[#8B8BA7]",
};

const urgencyLabel: Record<string, string> = {
  critical: "Критично",
  high: "Срочно",
  medium: "Важно",
};

export function ScenarioCard({ scenario, index, onClick, loading }: ScenarioCardProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.3 }}
      onClick={() => onClick(scenario.id)}
      disabled={loading}
      className={`w-full text-left bg-[#13131A] border ${urgencyBorder[scenario.urgency]} rounded-2xl p-4 transition-all duration-200 active:scale-[0.98] disabled:opacity-60`}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl shrink-0 mt-0.5">{scenario.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#F0F0FF] font-semibold text-base leading-tight">
              {scenario.title}
            </span>
            <span
              className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                scenario.urgency === "critical"
                  ? "bg-[#FF6B6B]/15 text-[#FF6B6B]"
                  : scenario.urgency === "high"
                  ? "bg-[#F59E0B]/15 text-[#F59E0B]"
                  : "bg-[#8B8BA7]/15 text-[#8B8BA7]"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${urgencyDot[scenario.urgency]}`} />
              {urgencyLabel[scenario.urgency]}
            </span>
          </div>
          <p className="text-[#8B8BA7] text-sm leading-snug">{scenario.description}</p>
          <div className="mt-2 text-xs text-[#8B8BA7]">
            {scenario.total_steps} {scenario.total_steps === 1 ? "вопрос" : "вопроса"} → план действий
          </div>
        </div>
        <div className="shrink-0 text-[#8B8BA7] mt-1">›</div>
      </div>
    </motion.button>
  );
}
