"use client";

import { OptionButton } from "../OptionButton";

const options = [
  { value: "yes", icon: "✅", label: "Да, есть" },
  { value: "in_progress", icon: "🔄", label: "В процессе" },
  { value: "no", icon: "❌", label: "Ещё нет" },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}

export function Step8({ value, onChange, onNext }: Props) {
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
