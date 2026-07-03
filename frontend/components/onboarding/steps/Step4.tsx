"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface Props {
  value: string | null;
  onChange: (v: string | null) => void;
  onNext: () => void;
}

export function Step4({ value, onChange, onNext }: Props) {
  const [noDate, setNoDate] = useState(!value);

  const handleNoDate = () => {
    setNoDate(true);
    onChange(null);
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
        className="w-full bg-[#13131A] border border-[#1E1E2E] focus:border-[#6C63FF]/60 text-[#F0F0FF] text-lg rounded-xl px-5 py-4 outline-none transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
      />

      <button
        type="button"
        onClick={handleNoDate}
        className={`flex items-center gap-3 w-full px-5 py-4 rounded-xl border text-sm font-medium transition-all duration-200 ${
          noDate
            ? "bg-[#6C63FF]/10 border-[#6C63FF] text-[#F0F0FF]"
            : "border-[#1E1E2E] bg-[#13131A] text-[#8B8BA7] hover:border-[#6C63FF]/40"
        }`}
      >
        <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${noDate ? "bg-[#6C63FF] border-[#6C63FF]" : "border-[#1E1E2E]"}`}>
          {noDate && <span className="text-white text-xs">✓</span>}
        </span>
        Ещё не записался на интервью
      </button>

      <motion.button
        onClick={onNext}
        disabled={!canContinue}
        whileHover={canContinue ? { scale: 1.02 } : {}}
        whileTap={canContinue ? { scale: 0.97 } : {}}
        className="w-full bg-gradient-to-r from-[#6C63FF] to-[#9C8BFF] text-white font-bold py-4 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed text-sm transition-all duration-200"
      >
        Продолжить →
      </motion.button>
    </div>
  );
}
