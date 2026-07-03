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
          <h1 className="text-xl font-bold text-[#F0F0FF]">Твой путь к визе</h1>
          <p className="text-[#8B8BA7] text-sm mt-0.5">
            Шаг <span className="text-[#6C63FF] font-semibold">{currentStepNumber}</span> из {totalSteps}
          </p>
        </div>
        <span className="text-[#6C63FF] font-bold text-lg tabular-nums">{progress}%</span>
      </div>
      <div className="h-2 bg-[#1E1E2E] rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-[#6C63FF] to-[#9C8BFF] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
