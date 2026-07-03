"use client";

import { motion } from "framer-motion";
import type { CommonMistake } from "@/lib/api";

interface Props {
  mistake: CommonMistake;
  index: number;
}

export function MistakeCard({ mistake, index }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="border-l-4 border-l-[#FF6B6B] border border-[#1E1E2E] bg-[#13131A] rounded-r-xl px-4 py-4 space-y-2"
    >
      <div className="flex items-start gap-2">
        <span className="text-[#FF6B6B] text-sm shrink-0 mt-0.5">❌</span>
        <p className="text-[#F0F0FF] text-sm font-medium leading-snug">{mistake.mistake}</p>
      </div>
      <div className="flex items-start gap-2">
        <span className="text-[#F59E0B] text-sm shrink-0 mt-0.5">⚡</span>
        <p className="text-[#F59E0B] text-xs leading-relaxed">
          <span className="font-semibold">Последствие:</span> {mistake.consequence}
        </p>
      </div>
      <div className="flex items-start gap-2">
        <span className="text-[#00D4AA] text-sm shrink-0 mt-0.5">✅</span>
        <p className="text-[#00D4AA] text-xs leading-relaxed">
          <span className="font-semibold">Решение:</span> {mistake.solution}
        </p>
      </div>
    </motion.div>
  );
}
