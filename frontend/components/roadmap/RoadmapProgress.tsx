"use client";

import { motion } from "framer-motion";

interface Props {
  currentStepNumber: number;
  totalSteps: number;
  progress: number;
}

export function RoadmapProgress({ currentStepNumber, totalSteps, progress }: Props) {
  return (
    <div className="mb-6">
      <div className="flex items-end justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-primary">Твой путь к визе</h1>
          <p className="text-secondary text-sm mt-0.5">
            Шаг <span className="text-accent font-semibold">{currentStepNumber}</span> из {totalSteps}
          </p>
        </div>
        <span className="text-accent font-bold text-lg tabular-nums">{progress}%</span>
      </div>
      <div className="h-2 bg-border rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-accent to-accent-light rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
