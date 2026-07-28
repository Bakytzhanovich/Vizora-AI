"use client";

import { useTranslation } from "react-i18next";
import { OptionButton } from "../OptionButton";

interface Props {
  value: boolean | null;
  onChange: (v: boolean) => void;
  onNext: () => void;
}

export function Step11({ value, onChange, onNext }: Props) {
  const { t } = useTranslation("onboarding");
  const options = [
    {
      value: true,
      icon: "🏢",
      label: t("steps.agency.via_agency"),
      desc: t("steps.agency.via_agency_desc"),
    },
    {
      value: false,
      icon: "🚀",
      label: t("steps.agency.self"),
      desc: t("steps.agency.self_desc"),
    },
  ];
  return (
    <div className="space-y-3">
      {options.map((opt) => (
        <OptionButton
          key={String(opt.value)}
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
