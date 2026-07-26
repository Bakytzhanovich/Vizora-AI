"use client";

import { useTranslation } from "react-i18next";
import { OptionButton } from "../OptionButton";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}

export function Step7({ value, onChange, onNext }: Props) {
  const { t } = useTranslation("onboarding");
  const options = [
    { value: "self", icon: "💰", label: t("steps.financial.self"), desc: t("steps.financial.self_desc") },
    { value: "parents", icon: "👨‍👩‍👧", label: t("steps.financial.parents"), desc: t("steps.financial.parents_desc") },
    { value: "scholarship", icon: "🎓", label: t("steps.financial.scholarship"), desc: t("steps.financial.scholarship_desc") },
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
