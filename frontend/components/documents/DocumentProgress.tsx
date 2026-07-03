"use client";

import { motion } from "framer-motion";

interface Props {
  completed: number;
  total: number;
  progress: number;
}

export function DocumentProgress({ completed, total, progress }: Props) {
  return (
    <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#F0F0FF] text-sm font-semibold">Готовность документов</span>
        <span className="text-[#6C63FF] text-sm font-bold">{progress}%</span>
      </div>
      <div className="h-2.5 bg-[#1E1E2E] rounded-full overflow-hidden mb-3">
        <motion.div
          className="h-full bg-gradient-to-r from-[#6C63FF] to-[#9C8BFF] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-[#8B8BA7]">
        <span>
          {completed} из {total} готово
        </span>
        {progress === 100 && (
          <span className="text-[#00D4AA] font-semibold">✓ Всё готово!</span>
        )}
      </div>
    </div>
  );
}
