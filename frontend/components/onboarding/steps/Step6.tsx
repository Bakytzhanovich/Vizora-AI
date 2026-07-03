"use client";

import { OptionButton } from "../OptionButton";

const options = [
  { value: true, icon: "✈️", label: "Да, выезжал" },
  { value: false, icon: "🏠", label: "Нет, первый раз" },
];

interface Props {
  value: boolean | null;
  onChange: (v: boolean) => void;
  onNext: () => void;
}

export function Step6({ value, onChange, onNext }: Props) {
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
