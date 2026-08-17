"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import type { RoadmapStepData } from "@/lib/api";
import { ActionButton } from "./ActionButton";
import { RoadmapLine } from "./RoadmapLine";

const MILESTONE_CONFIG: Record<string, { accent: string; bg: string; ring: string; badge?: string }> = {
  visa: {
    accent: "#F59E0B",
    bg: "bg-warning/10 border-warning/30",
    ring: "ring-warning/25",
    badge: "🏆 Главная цель!",
  },
  arrival: {
    accent: "#00D4AA",
    bg: "bg-teal/10 border-teal/30",
    ring: "ring-teal/25",
  },
  return: {
    accent: "#9C8BFF",
    bg: "bg-accent/10 border-accent/30",
    ring: "ring-accent/25",
  },
};

interface Props {
  step: RoadmapStepData;
  isLast: boolean;
  onMarkComplete: (id: string) => void;
  updating: boolean;
}

export const MilestoneStep = forwardRef<HTMLDivElement, Props>(
  ({ step, isLast, onMarkComplete, updating }, ref) => {
    const cfg = MILESTONE_CONFIG[step.id] ?? MILESTONE_CONFIG.visa;
    const isCompleted = step.status === "completed";
    const isCurrent = step.status === "in_progress";
    const isPending = step.status === "pending";

    const circleStyle = {
      // Completed/current: bright accent circle, near-black glyph — same in
      // both themes. Pending: neutral circle, which does need to track theme.
      backgroundColor: isCompleted || isCurrent ? cfg.accent : "rgb(var(--color-border))",
      color: isCompleted || isCurrent ? "#0A0A0F" : "rgb(var(--color-secondary))",
    };

    const cardClass = isCompleted
      ? `border-l-4 border-border bg-card opacity-80`
      : isCurrent
      ? `border-l-4 ${cfg.bg} shadow-lg`
      : "border border-border bg-card";

    const cardStyle = isCompleted
      ? { borderLeftColor: cfg.accent }
      : isCurrent
      ? { borderLeftColor: cfg.accent }
      : {};

    return (
      <div ref={ref}>
        <div className="flex gap-4 items-start">
          {/* Timeline indicator */}
          <div className="flex flex-col items-center shrink-0 w-10">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${isCurrent ? `ring-4 ${cfg.ring}` : ""}`}
              style={circleStyle}
            >
              {isCompleted ? (
                <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
                  <path d="M1 5.5L5 9.5L13 1.5" stroke="#0A0A0F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                step.number
              )}
            </div>
          </div>

          {/* Card */}
          <motion.div
            layout
            className={`flex-1 rounded-xl p-4 mb-1 transition-all ${cardClass}`}
            style={cardStyle}
          >
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <p className={`text-sm font-bold leading-snug ${isPending ? "text-secondary" : "text-primary"}`}>
                {step.title}
              </p>
              {cfg.badge && isCurrent && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ color: cfg.accent, backgroundColor: `${cfg.accent}20` }}
                >
                  {cfg.badge}
                </span>
              )}
              {cfg.badge && isCompleted && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ color: cfg.accent, backgroundColor: `${cfg.accent}20` }}
                >
                  {cfg.badge}
                </span>
              )}
            </div>

            {!isPending && (
              <p className="text-secondary text-xs mt-1 leading-relaxed">{step.description}</p>
            )}

            {isCompleted && step.completed_at && (
              <p className="text-xs mt-1.5 font-semibold" style={{ color: cfg.accent }}>
                ✓ Выполнено {new Date(step.completed_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
              </p>
            )}

            {isCurrent && (
              <>
                <div
                  className="mt-2 rounded-lg px-3 py-2"
                  style={{ backgroundColor: `${cfg.accent}18` }}
                >
                  <p className="text-xs leading-relaxed" style={{ color: cfg.accent }}>
                    💡 {step.tips}
                  </p>
                </div>
                <ActionButton stepId={step.id} />
                {!step.auto_complete && (
                  <button
                    onClick={() => onMarkComplete(step.id)}
                    disabled={updating}
                    className="mt-3 text-xs text-secondary hover:text-teal transition-colors disabled:opacity-50"
                  >
                    {updating ? "Сохраняем..." : "Отметить выполненным ✓"}
                  </button>
                )}
              </>
            )}

            {isPending && (
              <p className="text-secondary text-xs mt-1">Ещё впереди</p>
            )}
          </motion.div>
        </div>

        {!isLast && <RoadmapLine status={step.status} />}
      </div>
    );
  }
);

MilestoneStep.displayName = "MilestoneStep";
