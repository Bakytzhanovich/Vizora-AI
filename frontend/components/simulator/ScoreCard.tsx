"use client";

import { motion } from "framer-motion";

interface Props {
  label: string;
  score: number;
  color?: string;
  delay?: number;
}

export function ScoreCard({ label, score, color = "#6C63FF", delay = 0 }: Props) {
  const pct = Math.min(Math.max((score / 10) * 100, 0), 100);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[#8B8BA7] text-sm">{label}</span>
        <span className="text-[#F0F0FF] text-sm font-bold">{score.toFixed(1)}</span>
      </div>
      <div className="h-2 bg-[#1E1E2E] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
