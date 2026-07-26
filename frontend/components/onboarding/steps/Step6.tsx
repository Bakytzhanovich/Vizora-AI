"use client";

import { useTranslation } from "react-i18next";
import { OptionButton } from "../OptionButton";

interface Props {
  value: boolean | null;
  onChange: (v: boolean) => void;
  onNext: () => void;
}

export function Step6({ value, onChange, onNext }: Props) {
  const { t } = useTranslation("onboarding");
  const options = [
    { value: true, icon: "✈️", label: t("steps.travel.yes") },
    { value: false, icon: "🏠", label: t("steps.travel.no") },
  ];
  return (
    <div className="space-y-3">
      {options.map((opt) => (
        <OptionButton
          key={String(opt.value)}
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
