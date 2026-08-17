"use client";

import { useTranslation } from "react-i18next";
import type { CommonMistake } from "@/lib/api";
import { MistakeCard } from "./MistakeCard";

interface Props {
  mistakes: CommonMistake[];
}

export function CommonMistakes({ mistakes }: Props) {
  const { t } = useTranslation("documents");
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-primary font-bold text-lg">{t("mistakes.title")}</h2>
        <p className="text-secondary text-sm mt-1">{t("mistakes.subtitle")}</p>
      </div>

      <div className="space-y-3">
        {mistakes.map((m, i) => (
          <MistakeCard key={m.mistake} mistake={m} index={i} />
        ))}
      </div>

      <div className="mt-6 bg-error/5 border border-error/20 rounded-2xl p-4">
        <p className="text-error text-xs font-semibold mb-1">{t("mistakes.important_title")}</p>
        <p className="text-secondary text-xs leading-relaxed">
          {t("mistakes.important_text")}
        </p>
      </div>
    </div>
  );
}
