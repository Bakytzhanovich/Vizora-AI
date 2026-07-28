"use client";

import { useTranslation } from "react-i18next";
import { OptionButton } from "../OptionButton";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}

export function Step9({ value, onChange, onNext }: Props) {
  const { t } = useTranslation("onboarding");
  const options = [
    { value: "yes", icon: "✅", label: t("steps.job_offer.yes") },
    { value: "in_progress", icon: "🔄", label: t("steps.job_offer.in_progress") },
    { value: "no", icon: "❌", label: t("steps.job_offer.no") },
  ];
  return (
    <div className="space-y-3">
      {options.map((opt) => (
        <OptionButton
          key={opt.value}
          selected={value === opt.value}
          onClick={() => { onChange(opt.value); setTimeout(onNext, 220); }}
          className="min-h-[64px] text-lg"
        >
          <span className="text-2xl shrink-0">{opt.icon}</span>
          <span className="font-bold text-[#F0F0FF]">{opt.label}</span>
        </OptionButton>
      ))}
    </div>
  );
}
