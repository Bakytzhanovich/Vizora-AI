"use client";

import { OptionButton } from "../OptionButton";

const options = [
  { value: "weak", icon: "🔴", label: "Слабый", desc: "Мне сложно говорить" },
  { value: "medium", icon: "🟡", label: "Средний", desc: "Понимаю, но иногда теряюсь" },
  { value: "good", icon: "🟢", label: "Хороший", desc: "Говорю уверенно" },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}

export function Step5({ value, onChange, onNext }: Props) {
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
