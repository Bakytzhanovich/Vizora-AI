"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

interface Props {
  value: string | null;
  onChange: (v: string | null) => void;
  onNext: () => void;
}

export function Step5({ value, onChange, onNext }: Props) {
  const { t } = useTranslation("onboarding");
  const [noDate, setNoDate] = useState(!value);

  const toggleNoDate = () => {
    setNoDate((prev) => {
      const next = !prev;
      if (next) onChange(null);
      return next;
    });
  };

  const handleDateChange = (d: string) => {
    setNoDate(false);
    onChange(d);
  };

  const canContinue = noDate || !!value;

  return (
    <div className="space-y-4">
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => handleDateChange(e.target.value)}
        disabled={noDate}
        min={new Date().toISOString().split("T")[0]}
        className="w-full bg-card border border-border focus:border-accent/60 text-primary text-lg rounded-xl px-5 py-4 outline-none transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
      />

      <button
        type="button"
        onClick={toggleNoDate}
        className={`flex items-center gap-3 w-full px-5 py-4 rounded-xl border text-sm font-medium transition-all duration-200 ${
          noDate
            ? "bg-accent/10 border-accent text-primary"
            : "border-border bg-card text-secondary hover:border-accent/40"
        }`}
      >
        <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${noDate ? "bg-accent border-accent" : "border-border"}`}>
          {noDate && <span className="text-white text-xs">✓</span>}
        </span>
        {t("steps.interview_date.no_date")}
      </button>

      <motion.button
        onClick={onNext}
        disabled={!canContinue}
        whileHover={canContinue ? { scale: 1.02 } : {}}
        whileTap={canContinue ? { scale: 0.97 } : {}}
        className="w-full bg-gradient-to-r from-accent to-accent-light text-white font-bold py-4 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed text-sm transition-all duration-200"
      >
        {t("continue")}
      </motion.button>
    </div>
  );
}
