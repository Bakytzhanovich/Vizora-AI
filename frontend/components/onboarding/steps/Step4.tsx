"use client";

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}

export function Step4({ value, onChange, onNext }: Props) {
  const { t } = useTranslation("onboarding");
  return (
    <div className="space-y-5">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("steps.profession.placeholder")}
        autoFocus
        className="w-full bg-card border border-border focus:border-accent/60 text-primary placeholder-secondary/50 text-lg rounded-xl px-5 py-4 outline-none transition-colors duration-200"
        onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onNext(); }}
      />
      <motion.button
        onClick={onNext}
        disabled={!value.trim()}
        whileHover={value.trim() ? { scale: 1.02 } : {}}
        whileTap={value.trim() ? { scale: 0.97 } : {}}
        className="w-full bg-gradient-to-r from-accent to-accent-light text-white font-bold py-4 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed text-sm transition-all duration-200"
      >
        {t("continue")}
      </motion.button>
    </div>
  );
}
