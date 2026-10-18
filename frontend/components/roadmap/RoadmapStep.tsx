"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { RoadmapStepData } from "@/lib/api";
import { ActionButton } from "./ActionButton";
import { RoadmapLine } from "./RoadmapLine";

interface Props {
  step: RoadmapStepData;
  isLast: boolean;
  onMarkComplete: (id: string) => void;
  updating: boolean;
}

export const RoadmapStep = forwardRef<HTMLDivElement, Props>(
  ({ step, isLast, onMarkComplete, updating }, ref) => {
    const { t, i18n } = useTranslation("roadmap");
    const isCompleted = step.status === "completed";
    const isCurrent = step.status === "in_progress";
    const isPending = step.status === "pending";

    const circleClass = isCompleted
      ? "bg-teal text-white"
      : isCurrent
      ? "bg-accent text-white ring-4 ring-accent/25"
      : "bg-border text-secondary";

    const cardClass = isCompleted
      ? "border-l-4 border-l-teal border-border bg-card opacity-80"
      : isCurrent
      ? "border-l-4 border-l-accent border-accent/30 bg-accent/5 shadow-lg shadow-accent/10"
      : "border border-border bg-card";

    return (
      <div ref={ref}>
        <div className="flex gap-4 items-start">
          {/* Timeline indicator */}
          <div className="flex flex-col items-center shrink-0 w-10">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${circleClass}`}
            >
              {isCompleted ? (
                <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
                  <path d="M1 5.5L5 9.5L13 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
          >
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm font-semibold leading-snug ${isPending ? "text-secondary" : "text-primary"}`}>
                {t(`steps.${step.id}.title`)}
              </p>
              {isCurrent && (
                <span className="shrink-0 text-xs font-bold text-accent bg-accent/15 px-1.5 py-0.5 rounded-full">
                  {t("now").toUpperCase()}
                </span>
              )}
            </div>

            {!isPending && (
              <p className="text-secondary text-xs mt-1 leading-relaxed">{t(`steps.${step.id}.description`)}</p>
            )}

            {isCompleted && step.completed_at && (
              <p className="text-teal text-xs mt-1.5">
                {t("done_on", { date: new Date(step.completed_at).toLocaleDateString(i18n.language === "kz" ? "kk-KZ" : "ru-RU", { day: "numeric", month: "long" }) })}
              </p>
            )}

            {isCurrent && (
              <>
                <div className="mt-2 bg-accent/10 rounded-lg px-3 py-2">
                  <p className="text-primary text-xs leading-relaxed">💡 {t(`steps.${step.id}.tips`)}</p>
                </div>
                <ActionButton stepId={step.id} />
                {!step.auto_complete && (
                  <button
                    onClick={() => onMarkComplete(step.id)}
                    disabled={updating}
                    className="mt-1 min-h-11 text-xs text-secondary hover:text-teal transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {updating ? t("saving") : t("mark_done")}
                  </button>
                )}
              </>
            )}

            {isPending && !step.auto_complete && (
              <p className="text-secondary text-xs mt-1">{t("ahead")}</p>
            )}
          </motion.div>
        </div>

        {/* Connecting line between steps */}
        {!isLast && <RoadmapLine status={step.status} />}
      </div>
    );
  }
);

RoadmapStep.displayName = "RoadmapStep";
