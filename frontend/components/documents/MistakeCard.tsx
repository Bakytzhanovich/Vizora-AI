"use client";

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { CommonMistake } from "@/lib/api";

interface Props {
  mistake: CommonMistake;
  index: number;
}

export function MistakeCard({ mistake, index }: Props) {
  const { t } = useTranslation("documents");
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="border-l-4 border-l-error border border-border bg-card rounded-r-xl px-4 py-4 space-y-2"
    >
      <div className="flex items-start gap-2">
        <span className="text-error text-sm shrink-0 mt-0.5">❌</span>
        <p className="text-primary text-sm font-medium leading-snug">{mistake.mistake}</p>
      </div>
      <div className="flex items-start gap-2">
        <span className="text-warning text-sm shrink-0 mt-0.5">⚡</span>
        <p className="text-warning text-xs leading-relaxed">
          <span className="font-semibold">{t("mistakes.consequence")}:</span> {mistake.consequence}
        </p>
      </div>
      <div className="flex items-start gap-2">
        <span className="text-teal text-sm shrink-0 mt-0.5">✅</span>
        <p className="text-teal text-xs leading-relaxed">
          <span className="font-semibold">{t("mistakes.solution")}:</span> {mistake.solution}
        </p>
      </div>
    </motion.div>
  );
}
