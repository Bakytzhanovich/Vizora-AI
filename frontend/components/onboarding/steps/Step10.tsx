"use client";

import { OptionButton } from "../OptionButton";

const options = [
  {
    value: true,
    icon: "🏢",
    label: "Через агентство",
    desc: "Работаю с W&T агентством",
  },
  {
    value: false,
    icon: "🚀",
    label: "Самостоятельно",
    desc: "Оформляюсь сам",
  },
];

interface Props {
  value: boolean | null;
  onChange: (v: boolean) => void;
  onNext: () => void;
}

export function Step10({ value, onChange, onNext }: Props) {
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
