"use client";

import { useTranslation } from "react-i18next";
import { OptionButton } from "../OptionButton";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}

export function Step6({ value, onChange, onNext }: Props) {
  const { t } = useTranslation("onboarding");
  const options = [
    { value: "weak", icon: "🔴", label: t("steps.english.weak"), desc: t("steps.english.weak_desc") },
    { value: "medium", icon: "🟡", label: t("steps.english.medium"), desc: t("steps.english.medium_desc") },
    { value: "good", icon: "🟢", label: t("steps.english.good"), desc: t("steps.english.good_desc") },
  ];
  return (
    <div className="space-y-3">
      {options.map((opt) => (
        <OptionButton
          key={opt.value}
          selected={value === opt.value}
          onClick={() => { onChange(opt.value); setTimeout(onNext, 220); }}
        >
          <span className="text-2xl shrink-0">{opt.icon}</span>
          <div>
            <div className="font-bold text-[#F0F0FF]">{opt.label}</div>
            <div className="text-[#8B8BA7] text-sm font-normal">{opt.desc}</div>
          </div>
        </OptionButton>
      ))}
    </div>
  );
}
