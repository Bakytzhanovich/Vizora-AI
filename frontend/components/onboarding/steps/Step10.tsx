"use client";

import { useTranslation } from "react-i18next";
import { OptionButton } from "../OptionButton";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}

export function Step10({ value, onChange, onNext }: Props) {
  const { t } = useTranslation("onboarding");
  const options = [
    { value: "KZ", icon: "🇰🇿", label: t("steps.country.options.KZ") },
    { value: "UZ", icon: "🇺🇿", label: t("steps.country.options.UZ") },
    { value: "KG", icon: "🇰🇬", label: t("steps.country.options.KG") },
    { value: "AM", icon: "🇦🇲", label: t("steps.country.options.AM") },
    { value: "other", icon: "🌍", label: t("steps.country.options.other") },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {options.map((opt) => (
        <OptionButton
          key={opt.value}
          selected={value === opt.value}
          onClick={() => { onChange(opt.value); setTimeout(onNext, 220); }}
          className="min-h-[60px]"
        >
          <span className="text-2xl shrink-0">{opt.icon}</span>
          <span className="font-bold text-primary">{opt.label}</span>
        </OptionButton>
      ))}
    </div>
  );
}
