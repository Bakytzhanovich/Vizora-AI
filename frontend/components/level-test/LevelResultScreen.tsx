"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { CEFR, type Criteria, criteriaKeys, criterionFraction, criterionLabel } from "@/lib/englishLevel";

export interface LevelResult {
  level: string; // "A1" … "C2"; results before the CEFR rubric may end in "+"
  level_title: string;
  criteria: Criteria; // fluency is null when every answer was typed
  corrections: { wrong: string; correct: string; explanation_ru?: string }[];
  summary_ru: string;
  strengths: string[];
  improve: string[];
  visa_note_ru: string;
  question_count: number;
  profile_updated?: boolean;
  finished_early?: boolean;
}


interface Props {
  result: LevelResult;
  onRetry: () => void;
  onBack: () => void;
}

export function LevelResultScreen({ result, onRetry, onBack }: Props) {
  const { t } = useTranslation("simulator");
  const router = useRouter();
  const baseLevel = result.level.replace("+", "");
  const reached = CEFR.indexOf(baseLevel as (typeof CEFR)[number]);

  return (
    <div className="min-h-screen bg-bg px-4 py-6 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        {/* Level */}
        <div className="bg-card border border-accent/30 rounded-2xl px-6 py-8 text-center mb-4">
          <p className="text-secondary text-xs font-semibold uppercase tracking-wide mb-2">
            {t("level_test.your_level")}
          </p>
          <motion.p
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="text-6xl font-bold text-accent mb-1"
          >
            {result.level}
          </motion.p>
          <p className="text-primary font-semibold mb-6">{result.level_title}</p>

          <div className="flex gap-1.5 max-w-xs mx-auto mb-2">
            {CEFR.map((lvl, i) => (
              <div key={lvl} className="flex-1">
                <div className={`h-2 rounded-full ${i <= reached ? "bg-accent" : "bg-border"}`} />
                <p className={`text-[10px] mt-1 ${i === reached ? "text-accent font-bold" : "text-secondary"}`}>{lvl}</p>
              </div>
            ))}
          </div>

          <p className="text-secondary text-sm leading-relaxed mt-4">{result.summary_ru}</p>
          {result.finished_early && (
            <p className="text-warning text-xs leading-relaxed mt-4">
              {t("level_test.finished_early_note", { count: result.question_count })}
            </p>
          )}
          <p className="text-secondary/60 text-[11px] mt-4">{t("level_test.disclaimer")}</p>
        </div>

        {/* Criteria */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-4">
          <h2 className="text-primary font-semibold text-sm mb-4">{t("level_test.criteria_title")}</h2>
          <div className="space-y-3">
            {criteriaKeys(result.criteria).map((key) => {
              const value = result.criteria[key] ?? null;
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-secondary">{t(`level_test.criteria.${key}`)}</span>
                    <span className="text-primary font-semibold tabular-nums">
                      {criterionLabel(value) ?? t("level_test.no_fluency")}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${criterionFraction(value) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Corrections from the student's own answers */}
        {result.corrections.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5 mb-4">
            <h2 className="text-primary font-semibold text-sm mb-3">{t("level_test.corrections_title")}</h2>
            <div className="space-y-3">
              {result.corrections.map((c, i) => (
                <div key={i} className="text-sm">
                  <p className="text-error line-through">{c.wrong}</p>
                  <p className="text-teal">→ {c.correct}</p>
                  {c.explanation_ru && <p className="text-secondary text-xs mt-0.5">{c.explanation_ru}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {(result.strengths.length > 0 || result.improve.length > 0) && (
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            {result.strengths.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <h2 className="text-primary font-semibold text-sm mb-3">{t("level_test.strengths_title")}</h2>
                <ul className="space-y-2">
                  {result.strengths.map((s) => (
                    <li key={s} className="flex gap-2 text-xs text-secondary">
                      <span className="text-teal shrink-0">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.improve.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <h2 className="text-primary font-semibold text-sm mb-3">{t("level_test.improve_title")}</h2>
                <ul className="space-y-2">
                  {result.improve.map((s) => (
                    <li key={s} className="flex gap-2 text-xs text-secondary">
                      <span className="text-accent shrink-0">→</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* What it means for the visa interview */}
        <div className="bg-accent/10 border border-accent/30 rounded-2xl p-5 mb-6">
          <h2 className="text-primary font-semibold text-sm mb-2">🇺🇸 {t("level_test.visa_title")}</h2>
          <p className="text-secondary text-sm leading-relaxed">{result.visa_note_ru}</p>
          {result.profile_updated && (
            <p className="text-teal text-xs mt-3">✓ {t("level_test.profile_updated")}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onBack}
            className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3.5 rounded-2xl transition-all"
          >
            {t("level_test.to_trainer")}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onRetry}
              className="flex-1 border border-border text-secondary hover:text-primary py-3 rounded-2xl text-sm transition-all"
            >
              {t("level_test.retry")}
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex-1 border border-border text-secondary hover:text-primary py-3 rounded-2xl text-sm transition-all"
            >
              {t("level_test.to_dashboard")}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
