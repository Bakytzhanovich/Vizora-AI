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
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-lg">
          {mode === "consul" ? "🏛️" : "🎓"}
        </div>
        <div>
          <div className="text-primary text-sm font-semibold">
            {mode === "consul" ? t("interview.officer") : t("interview.officer_trainer")}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {(isStreaming || isPlaying) ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
                <span className="text-teal text-xs">
                  {isStreaming ? t("interview.typing") : t("interview.speaking")}
                </span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                <span className="text-secondary text-xs">{t("interview.waiting")}</span>
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
                className="w-0.5 bg-accent rounded-full"
                animate={{ height: [`${h * 4}px`, `${h * 8}px`, `${h * 4}px`] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
              />
            ))}
          </div>
        )}
      </div>

      <p className="text-primary text-sm leading-relaxed whitespace-pre-wrap">
        {question || "..."}
      </p>
    </div>
  );
}
