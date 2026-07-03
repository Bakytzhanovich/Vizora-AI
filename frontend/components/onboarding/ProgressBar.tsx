"use client";

import { motion } from "framer-motion";

interface Props {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: Props) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[#8B8BA7] text-xs font-medium">
          Шаг {current} из {total}
        </span>
        <span className="text-[#6C63FF] text-xs font-bold">{pct}%</span>
      </div>
      <div className="h-1.5 bg-[#1E1E2E] rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-[#6C63FF] to-[#9C8BFF] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
