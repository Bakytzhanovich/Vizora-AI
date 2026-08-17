"use client";

import { motion } from "framer-motion";
import type { EmergencyStep } from "@/lib/api";
import { ProgressIndicator } from "./ProgressIndicator";

interface GuidedStepProps {
  step: EmergencyStep;
  stepIndex: number;
  totalSteps: number;
  scenarioTitle: string;
  scenarioIcon: string;
  onAnswer: (answer: string) => void;
  loading?: boolean;
  selectedAnswer?: string;
}

export function GuidedStep({
  step,
  stepIndex,
  totalSteps,
  scenarioTitle,
  scenarioIcon,
  onAnswer,
  loading,
  selectedAnswer,
}: GuidedStepProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Scenario context */}
      <div className="flex items-center gap-2 text-sm text-secondary">
        <span>{scenarioIcon}</span>
        <span>{scenarioTitle}</span>
      </div>

      {/* Progress */}
      <ProgressIndicator current={stepIndex} total={totalSteps} />

      {/* Question */}
      <motion.div
        key={step.id}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-primary text-xl font-bold leading-snug mb-6">
          {step.question}
        </h2>

        {/* Options */}
        <div className="flex flex-col gap-3">
          {step.options.map((option, i) => (
            <motion.button
              key={option}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.25 }}
              onClick={() => !loading && onAnswer(option)}
              disabled={loading}
              className={`w-full text-left px-5 py-4 rounded-2xl border font-medium text-base transition-all duration-150 active:scale-[0.98] min-h-[56px] ${
                selectedAnswer === option
                  ? "bg-error/15 border-error text-error"
                  : "bg-card border-border text-primary hover:border-warning/60 hover:bg-border-hover"
              } disabled:opacity-60`}
            >
              {option}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {loading && (
        <div className="flex items-center justify-center py-2">
          <div className="w-5 h-5 border-2 border-error/30 border-t-error rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
