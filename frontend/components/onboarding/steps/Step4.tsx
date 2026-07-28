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
        className="w-full bg-[#13131A] border border-[#1E1E2E] focus:border-[#6C63FF]/60 text-[#F0F0FF] placeholder-[#8B8BA7]/50 text-lg rounded-xl px-5 py-4 outline-none transition-colors duration-200"
        onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onNext(); }}
      />
      <motion.button
        onClick={onNext}
        disabled={!value.trim()}
        whileHover={value.trim() ? { scale: 1.02 } : {}}
        whileTap={value.trim() ? { scale: 0.97 } : {}}
        className="w-full bg-gradient-to-r from-[#6C63FF] to-[#9C8BFF] text-white font-bold py-4 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed text-sm transition-all duration-200"
      >
        {t("continue")}
      </motion.button>
    </div>
  );
}
