"use client";

import type { CommonMistake } from "@/lib/api";
import { MistakeCard } from "./MistakeCard";

interface Props {
  mistakes: CommonMistake[];
}

export function CommonMistakes({ mistakes }: Props) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-[#F0F0FF] font-bold text-lg">Частые ошибки при заполнении</h2>
        <p className="text-[#8B8BA7] text-sm mt-1">Избегай этих ошибок — они стоят визы</p>
      </div>

      <div className="space-y-3">
        {mistakes.map((m, i) => (
          <MistakeCard key={m.mistake} mistake={m} index={i} />
        ))}
      </div>

      <div className="mt-6 bg-[#FF6B6B]/5 border border-[#FF6B6B]/20 rounded-2xl p-4">
        <p className="text-[#FF6B6B] text-xs font-semibold mb-1">⚠️ Важно помнить</p>
        <p className="text-[#8B8BA7] text-xs leading-relaxed">
          Анкета DS-160 проверяется офицером. Любое несоответствие с другими документами вызывает вопросы.
          Заполняй анкету вместе с чек-листом документов.
        </p>
      </div>
    </div>
  );
}
