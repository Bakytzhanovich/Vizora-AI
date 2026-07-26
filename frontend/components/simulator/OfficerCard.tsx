"use client";

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

interface Props {
  question: string;
  mode: "trainer" | "consul";
  isStreaming: boolean;
  isPlaying: boolean;
}

export function OfficerCard({ question, mode, isStreaming, isPlaying }: Props) {
  const { t } = useTranslation("simulator");
  return (
    <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[#6C63FF]/10 border border-[#6C63FF]/20 flex items-center justify-center text-lg">
          {mode === "consul" ? "🏛️" : "🎓"}
        </div>
        <div>
          <div className="text-[#F0F0FF] text-sm font-semibold">
            {mode === "consul" ? t("interview.officer") : t("interview.officer_trainer")}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {(isStreaming || isPlaying) ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse" />
                <span className="text-[#00D4AA] text-xs">
                  {isStreaming ? t("interview.typing") : t("interview.speaking")}
                </span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#8B8BA7]" />
                <span className="text-[#8B8BA7] text-xs">{t("interview.waiting")}</span>
              </>
            )}
          </div>
        </div>

        {/* Audio waveform when playing */}
        {isPlaying && (
          <div className="ml-auto flex items-center gap-0.5 h-5">
            {[1, 2, 3, 4, 3].map((h, i) => (
              <motion.div
                key={i}
                className="w-0.5 bg-[#6C63FF] rounded-full"
                animate={{ height: [`${h * 4}px`, `${h * 8}px`, `${h * 4}px`] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
              />
            ))}
          </div>
        )}
      </div>

      <p className="text-[#F0F0FF] text-sm leading-relaxed whitespace-pre-wrap">
        {question || "..."}
      </p>
    </div>
  );
}
