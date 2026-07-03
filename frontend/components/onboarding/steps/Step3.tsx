"use client";

import { OptionButton } from "../OptionButton";

interface Props {
  value: number | null;
  onChange: (v: number) => void;
  onNext: () => void;
}

export function Step3({ value, onChange, onNext }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((year) => (
          <OptionButton
            key={year}
            selected={value === year}
            onClick={() => { onChange(year); setTimeout(onNext, 200); }}
            className="justify-center text-center min-h-[72px] text-xl"
          >
            {year}
          </OptionButton>
        ))}
      </div>
      <div className="flex justify-between text-xs text-[#8B8BA7] px-1">
        <span>1 курс</span>
        <span>5 курс</span>
      </div>
    </div>
  );
}
