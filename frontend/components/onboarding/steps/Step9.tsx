"use client";

import { OptionButton } from "../OptionButton";

const options = [
  { value: "KZ", icon: "🇰🇿", label: "Казахстан" },
  { value: "UZ", icon: "🇺🇿", label: "Узбекистан" },
  { value: "KG", icon: "🇰🇬", label: "Кыргызстан" },
  { value: "AM", icon: "🇦🇲", label: "Армения" },
  { value: "other", icon: "🌍", label: "Другая" },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}

export function Step9({ value, onChange, onNext }: Props) {
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
          <span className="font-bold text-[#F0F0FF]">{opt.label}</span>
        </OptionButton>
      ))}
    </div>
  );
}
