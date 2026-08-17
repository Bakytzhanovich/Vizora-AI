"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OptionButton } from "../OptionButton";

interface Props {
  value: number | null;
  onChange: (v: number) => void;
  onNext: () => void;
}

export function Step3({ value, onChange, onNext }: Props) {
  const { t } = useTranslation("onboarding");
  const options = t("steps.course.options", { returnObjects: true }) as string[];
  const [showCustom, setShowCustom] = useState(value !== null && value > 4);
  const [customValue, setCustomValue] = useState(value !== null && value > 4 ? String(value) : "");

  const confirmCustom = () => {
    const year = parseInt(customValue, 10);
    if (Number.isInteger(year) && year >= 5) {
      onChange(year);
      onNext();
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((year) => (
          <OptionButton
            key={year}
            selected={!showCustom && value === year}
            onClick={() => {
              setShowCustom(false);
              onChange(year);
              setTimeout(onNext, 200);
            }}
            className="justify-center text-center min-h-[72px] text-xl"
          >
            {year}
          </OptionButton>
        ))}
      </div>
      <OptionButton
        selected={showCustom}
        onClick={() => setShowCustom(true)}
        className="justify-center text-center min-h-[56px] text-base"
      >
        {t("steps.course.custom_label")}
      </OptionButton>
      {showCustom && (
        <div className="flex gap-2">
          <input
            type="number"
            min={5}
            autoFocus
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmCustom(); }}
            placeholder={t("steps.course.custom_placeholder")}
            className="flex-1 w-full bg-card border border-border focus:border-accent/60 text-primary placeholder-secondary/50 text-lg rounded-xl px-5 py-4 outline-none transition-colors duration-200"
          />
          <button
            onClick={confirmCustom}
            disabled={!(parseInt(customValue, 10) >= 5)}
            className="shrink-0 bg-gradient-to-r from-accent to-accent-light text-white font-bold px-6 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed text-sm transition-all duration-200"
          >
            {t("continue")}
          </button>
        </div>
      )}
      <div className="flex justify-between text-xs text-secondary px-1">
        <span>{options[0]}</span>
        <span>{t("steps.course.custom_label")}</span>
      </div>
    </div>
  );
}
