"use client";

import { OptionButton } from "../OptionButton";

const options = [
  { value: "self", icon: "💰", label: "Сам", desc: "Есть свои сбережения" },
  { value: "parents", icon: "👨‍👩‍👧", label: "Родители", desc: "Помогают родители" },
  { value: "scholarship", icon: "🎓", label: "Стипендия", desc: "Грант или стипендия" },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}

export function Step7({ value, onChange, onNext }: Props) {
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
