"use client";

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

export interface TranscriptEntry {
  id: string;
  role: "officer" | "student";
  content: string;
}

interface Props {
  entry: TranscriptEntry;
  index: number;
  mode: "trainer" | "consul";
}

export function TranscriptItem({ entry, index, mode }: Props) {
  const { t } = useTranslation("simulator");
  const isOfficer = entry.role === "officer";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className={`flex gap-2 mb-3 ${isOfficer ? "flex-row" : "flex-row-reverse"}`}
    >
      <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs mt-0.5">
        {isOfficer ? (mode === "consul" ? "🏛️" : "🎓") : "👤"}
      </div>

      <div className={`max-w-[85%] ${isOfficer ? "" : "items-end flex flex-col"}`}>
        <span className="text-secondary text-[10px] mb-1 px-1">
          {isOfficer ? (mode === "consul" ? t("transcript.officer") : t("transcript.trainer")) : t("transcript.you")}
        </span>
        <div
          className={`px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
            isOfficer
              ? "bg-card border border-border text-primary"
              : "bg-accent text-white"
          }`}
        >
          {entry.content}
        </div>
      </div>
    </motion.div>
  );
}
