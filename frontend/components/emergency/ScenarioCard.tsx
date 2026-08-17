"use client";

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { EmergencyScenario } from "@/lib/api";

interface ScenarioCardProps {
  scenario: EmergencyScenario;
  index: number;
  onClick: (id: string) => void;
  loading?: boolean;
}

const urgencyBorder: Record<string, string> = {
  critical: "border-error/40 hover:border-error",
  high: "border-warning/30 hover:border-warning",
  medium: "border-border hover:border-warning/50",
};

const urgencyDot: Record<string, string> = {
  critical: "bg-error",
  high: "bg-warning",
  medium: "bg-secondary",
};

export function ScenarioCard({ scenario, index, onClick, loading }: ScenarioCardProps) {
  const { t } = useTranslation("emergency");
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.3 }}
      onClick={() => onClick(scenario.id)}
      disabled={loading}
      className={`w-full text-left bg-card border ${urgencyBorder[scenario.urgency]} rounded-2xl p-4 transition-all duration-200 active:scale-[0.98] disabled:opacity-60`}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl shrink-0 mt-0.5">{scenario.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-primary font-semibold text-base leading-tight">
              {scenario.title}
            </span>
            <span
              className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                scenario.urgency === "critical"
                  ? "bg-error/15 text-error"
                  : scenario.urgency === "high"
                  ? "bg-warning/15 text-warning"
                  : "bg-secondary/15 text-secondary"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${urgencyDot[scenario.urgency]}`} />
              {t(`urgency.${scenario.urgency}`)}
            </span>
          </div>
          <p className="text-secondary text-sm leading-snug">{scenario.description}</p>
          <div className="mt-2 text-xs text-secondary">
            {t(scenario.total_steps === 1 ? "steps_label_one" : "steps_label_other", { n: scenario.total_steps })}
          </div>
        </div>
        <div className="shrink-0 text-secondary mt-1">›</div>
      </div>
    </motion.button>
  );
}
