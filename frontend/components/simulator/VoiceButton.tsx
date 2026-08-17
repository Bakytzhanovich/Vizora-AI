"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Mic, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export type VoiceState = "idle" | "recording" | "processing" | "playing";

interface Props {
  state: VoiceState;
  onClick: () => void;
  disabled?: boolean;
}

export function VoiceButton({ state, onClick, disabled = false }: Props) {
  const { t } = useTranslation("simulator");
  const config = {
    idle: { bg: "bg-accent", ring: "ring-accent/30", label: t("voice.idle"), pulse: false },
    recording: { bg: "bg-error", ring: "ring-error/40", label: t("voice.recording"), pulse: true },
    processing: { bg: "bg-warning", ring: "ring-warning/30", label: t("voice.processing"), pulse: false },
    playing: { bg: "bg-teal", ring: "ring-teal/30", label: t("voice.playing"), pulse: true },
  };
  const cfg = config[state];

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.button
        onClick={onClick}
        disabled={disabled || state === "processing" || state === "playing"}
        whileTap={{ scale: 0.93 }}
        className={`relative w-20 h-20 rounded-full ${cfg.bg} ring-4 ${cfg.ring} flex items-center justify-center text-white shadow-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        <AnimatePresence>
          {cfg.pulse && (
            <motion.span
              key="pulse"
              className={`absolute inset-0 rounded-full ${cfg.bg} opacity-40`}
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </AnimatePresence>

        {state === "processing" ? (
          <Loader2 size={28} className="animate-spin" />
        ) : (
          <Mic size={28} />
        )}
      </motion.button>

      <p className="text-secondary text-xs text-center">{cfg.label}</p>
    </div>
  );
}
