"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScoreCard } from "./ScoreCard";

interface Scores {
  confidence: number;
  language: number;
  content: number;
  overall: number;
}

interface AnswerAnalysis {
  question: string;
  student_answer: string;
  verdict: "good" | "warning" | "critical";
  what_was_good: string | null;
  what_was_wrong: string | null;
  better_answer: string | null;
}

interface KeyMistake {
  mistake: string;
  severity: "critical" | "warning";
  explanation: string;
  correct_action: string;
}

interface PhraseToMemorize {
  situation: string;
  wrong: string;
  correct: string;
}

export interface FeedbackData {
  scores: Scores;
  // New detailed fields
  answer_analysis?: AnswerAnalysis[];
  key_mistakes?: KeyMistake[];
  strong_points: string[];
  phrases_to_memorize?: PhraseToMemorize[];
  next_session_focus?: string[];
  recommendation: string;
  // Revealed only for consul-mode sessions, after the session ends
  officer_personality?: "neutral" | "friendly" | "strict";
  officer_reveal?: string;
  // Legacy fields (kept for backward compat)
  weak_points?: string[];
  phrases_to_use?: string[];
  risk_flags?: string[];
}

interface HistoryItem {
  id: string;
  mode: string;
  difficulty: string;
  scores: Scores | null;
  completed: boolean;
  duration_seconds: number;
  created_at: string;
  question_count: number;
}

interface Props {
  feedback: FeedbackData;
  history: HistoryItem[];
  onRetry: () => void;
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const VERDICT_CONFIG = {
  good:     { label: "Хорошо",       bg: "bg-[#00D4AA]/10", border: "border-[#00D4AA]/30", text: "text-[#00D4AA]",  icon: "✅" },
  warning:  { label: "Есть замечания", bg: "bg-[#F59E0B]/10", border: "border-[#F59E0B]/30", text: "text-[#F59E0B]",  icon: "⚠️" },
  critical: { label: "Серьёзная ошибка", bg: "bg-[#FF6B6B]/10", border: "border-[#FF6B6B]/30", text: "text-[#FF6B6B]", icon: "❌" },
};

function AnswerCard({ item, index }: { item: AnswerAnalysis; index: number }) {
  const [open, setOpen] = useState(item.verdict !== "good");
  const cfg = VERDICT_CONFIG[item.verdict];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`border rounded-xl overflow-hidden ${cfg.border} ${cfg.bg}`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3 flex items-start justify-between gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold ${cfg.text} shrink-0`}>
              {cfg.icon} {cfg.label}
            </span>
          </div>
          <p className="text-[#8B8BA7] text-xs leading-relaxed truncate">Q: {item.question}</p>
          <p className="text-[#F0F0FF] text-xs leading-relaxed truncate mt-0.5">A: {item.student_answer}</p>
        </div>
        <span className="text-[#8B8BA7] shrink-0 mt-1">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
              {item.what_was_good && (
                <div>
                  <p className="text-[#00D4AA] text-xs font-semibold mb-0.5">Что хорошо</p>
                  <p className="text-[#C8C8E0] text-xs leading-relaxed">{item.what_was_good}</p>
                </div>
              )}
              {item.what_was_wrong && (
                <div>
                  <p className="text-[#FF6B6B] text-xs font-semibold mb-0.5">Что не так</p>
                  <p className="text-[#C8C8E0] text-xs leading-relaxed">{item.what_was_wrong}</p>
                </div>
              )}
              {item.better_answer && (
                <div className="bg-[#0A0A0F] rounded-lg p-3">
                  <p className="text-[#6C63FF] text-xs font-semibold mb-1">Лучший ответ</p>
                  <p className="text-[#C8C8E0] text-xs leading-relaxed italic">&ldquo;{item.better_answer}&rdquo;</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MistakeCard({ item, index }: { item: KeyMistake; index: number }) {
  const isCritical = item.severity === "critical";
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`border rounded-xl p-4 ${isCritical ? "border-[#FF6B6B]/30 bg-[#FF6B6B]/5" : "border-[#F59E0B]/30 bg-[#F59E0B]/5"}`}
    >
      <div className="flex items-start gap-2 mb-2">
        <span className="text-sm shrink-0">{isCritical ? "❌" : "⚠️"}</span>
        <p className={`text-xs font-bold ${isCritical ? "text-[#FF6B6B]" : "text-[#F59E0B]"}`}>{item.mistake}</p>
      </div>
      <p className="text-[#8B8BA7] text-xs leading-relaxed mb-2">{item.explanation}</p>
      <div className="bg-[#0A0A0F] rounded-lg p-2.5">
        <p className="text-[#00D4AA] text-xs font-semibold mb-0.5">Правильное действие</p>
        <p className="text-[#C8C8E0] text-xs leading-relaxed">{item.correct_action}</p>
      </div>
    </motion.div>
  );
}

function PhraseCard({ item, index }: { item: PhraseToMemorize; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-4"
    >
      <p className="text-[#6C63FF] text-xs font-bold mb-3">{item.situation}</p>
      <div className="space-y-2">
        <div className="flex gap-2 items-start">
          <span className="text-[#FF6B6B] text-xs font-bold shrink-0 mt-0.5">❌</span>
          <p className="text-[#8B8BA7] text-xs leading-relaxed italic">&ldquo;{item.wrong}&rdquo;</p>
        </div>
        <div className="flex gap-2 items-start">
          <span className="text-[#00D4AA] text-xs font-bold shrink-0 mt-0.5">✅</span>
          <p className="text-[#C8C8E0] text-xs leading-relaxed italic">&ldquo;{item.correct}&rdquo;</p>
        </div>
      </div>
    </motion.div>
  );
}

export function ResultsScreen({ feedback, history, onRetry }: Props) {
  const router = useRouter();
  const { t } = useTranslation("simulator");
  const { scores } = feedback;
  const overall = scores.overall ?? ((scores.confidence + scores.language + scores.content) / 3);
  const pct = Math.round((overall / 10) * 100);

  const hasNewFormat = !!(feedback.answer_analysis?.length || feedback.key_mistakes?.length);

  // Sort: critical first, then warning, then good
  const sortedAnswers = [...(feedback.answer_analysis ?? [])].sort((a, b) => {
    const order = { critical: 0, warning: 1, good: 2 };
    return order[a.verdict] - order[b.verdict];
  });

  const criticalMistakes = (feedback.key_mistakes ?? []).filter((m) => m.severity === "critical");
  const warningMistakes = (feedback.key_mistakes ?? []).filter((m) => m.severity === "warning");
  const sortedMistakes = [...criticalMistakes, ...warningMistakes];

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 py-6 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-[#F0F0FF]">{t("results.title")}</h1>
          <p className="text-[#8B8BA7] text-xs mt-1">{t("results.subtitle")}</p>
        </div>

        {/* Officer reveal — consul mode only */}
        {feedback.officer_reveal && (
          <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl px-4 py-3 mb-6 flex items-center gap-3">
            <span className="text-2xl shrink-0">🏛️</span>
            <p className="text-[#C8C8E0] text-sm leading-relaxed">{feedback.officer_reveal}</p>
          </div>
        )}

        {/* Score circle */}
        <div className="flex justify-center mb-6">
          <div className="relative w-28 h-28">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#1E1E2E" strokeWidth="8" />
              <motion.circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke={overall >= 7 ? "#00D4AA" : overall >= 5 ? "#F59E0B" : "#FF6B6B"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - pct / 100) }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-[#F0F0FF]">{overall.toFixed(1)}</span>
              <span className="text-[#8B8BA7] text-xs">/10</span>
            </div>
          </div>
        </div>

        {/* Score bars */}
        <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-5 mb-4">
          <h2 className="text-[#F0F0FF] text-sm font-semibold mb-4">{t("results.detailed_scores")}</h2>
          <ScoreCard label={t("results.confidence")} score={scores.confidence} delay={0.1} />
          <ScoreCard label={t("results.language")} score={scores.language} delay={0.2} />
          <ScoreCard label={t("results.content")} score={scores.content} delay={0.3} />
          <div className="border-t border-[#1E1E2E] pt-3 mt-1">
            <ScoreCard label={t("results.total")} score={overall} color="#00D4AA" delay={0.4} />
          </div>
        </div>

        {/* Recommendation */}
        {feedback.recommendation && (
          <div className="bg-[#6C63FF]/10 border border-[#6C63FF]/20 rounded-2xl p-4 mb-6">
            <p className="text-[#9C8BFF] text-xs font-semibold mb-1">{t("results.recommendation")}</p>
            <p className="text-[#F0F0FF] text-sm leading-relaxed">{feedback.recommendation}</p>
          </div>
        )}

        {hasNewFormat ? (
          <>
            {/* Answer-by-answer breakdown */}
            {sortedAnswers.length > 0 && (
              <div className="mb-6">
                <h2 className="text-[#F0F0FF] text-sm font-semibold mb-3">
                  Разбор ответов
                  <span className="text-[#8B8BA7] font-normal ml-2 text-xs">
                    ({sortedAnswers.filter((a) => a.verdict === "critical").length} ❌ &nbsp;
                    {sortedAnswers.filter((a) => a.verdict === "warning").length} ⚠️ &nbsp;
                    {sortedAnswers.filter((a) => a.verdict === "good").length} ✅)
                  </span>
                </h2>
                <div className="space-y-2">
                  {sortedAnswers.map((item, i) => (
                    <AnswerCard key={i} item={item} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Key mistakes */}
            {sortedMistakes.length > 0 && (
              <div className="mb-6">
                <h2 className="text-[#F0F0FF] text-sm font-semibold mb-3">Ключевые ошибки</h2>
                <div className="space-y-3">
                  {sortedMistakes.map((item, i) => (
                    <MistakeCard key={i} item={item} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Strong points */}
            {feedback.strong_points.length > 0 && (
              <div className="bg-[#00D4AA]/5 border border-[#00D4AA]/20 rounded-2xl p-4 mb-4">
                <h3 className="text-[#00D4AA] text-xs font-bold mb-3">✅ Что ты сделал правильно</h3>
                <ul className="space-y-2">
                  {feedback.strong_points.map((p, i) => (
                    <li key={i} className="flex gap-2 text-xs text-[#C8C8E0] leading-relaxed">
                      <span className="text-[#00D4AA] shrink-0">•</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Phrases to memorize */}
            {(feedback.phrases_to_memorize ?? []).length > 0 && (
              <div className="mb-6">
                <h2 className="text-[#F0F0FF] text-sm font-semibold mb-3">Фразы для запоминания</h2>
                <div className="space-y-3">
                  {(feedback.phrases_to_memorize ?? []).map((item, i) => (
                    <PhraseCard key={i} item={item} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Next session focus */}
            {(feedback.next_session_focus ?? []).length > 0 && (
              <div className="bg-[#6C63FF]/5 border border-[#6C63FF]/20 rounded-2xl p-4 mb-6">
                <h3 className="text-[#9C8BFF] text-xs font-bold mb-3">🎯 Фокус следующей сессии</h3>
                <ul className="space-y-2">
                  {(feedback.next_session_focus ?? []).map((item, i) => (
                    <li key={i} className="flex gap-2 text-xs text-[#C8C8E0] leading-relaxed">
                      <span className="text-[#6C63FF] font-bold shrink-0">{i + 1}.</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          /* Legacy fallback for old feedback format */
          <div className="space-y-4 mb-6">
            {feedback.strong_points.length > 0 && (
              <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-4">
                <h3 className="text-[#00D4AA] text-xs font-bold mb-3">✅ {t("results.strong")}</h3>
                <ul className="space-y-2">
                  {feedback.strong_points.map((p, i) => (
                    <li key={i} className="text-[#8B8BA7] text-xs leading-relaxed">{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {(feedback.weak_points ?? []).length > 0 && (
              <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-4">
                <h3 className="text-[#F59E0B] text-xs font-bold mb-3">⚠️ {t("results.improve")}</h3>
                <ul className="space-y-2">
                  {(feedback.weak_points ?? []).map((p, i) => (
                    <li key={i} className="text-[#8B8BA7] text-xs leading-relaxed">{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {(feedback.risk_flags ?? []).length > 0 && (
              <div className="bg-[#FF6B6B]/5 border border-[#FF6B6B]/20 rounded-2xl p-4">
                <h3 className="text-[#FF6B6B] text-xs font-bold mb-3">🚩 {t("results.flags")}</h3>
                <ul className="space-y-2">
                  {(feedback.risk_flags ?? []).map((f, i) => (
                    <li key={i} className="text-[#FF6B6B]/80 text-xs leading-relaxed">{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {(feedback.phrases_to_use ?? []).length > 0 && (
              <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-4">
                <h3 className="text-[#6C63FF] text-xs font-bold mb-3">💡 {t("results.phrases")}</h3>
                <ul className="space-y-2">
                  {(feedback.phrases_to_use ?? []).map((p, i) => (
                    <li key={i} className="text-[#8B8BA7] text-xs leading-relaxed italic">&ldquo;{p}&rdquo;</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={onRetry}
            className="flex-1 border border-[#6C63FF] text-[#6C63FF] font-semibold py-3 rounded-xl hover:bg-[#6C63FF]/10 transition-all text-sm"
          >
            {t("results.retry")}
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex-1 bg-[#6C63FF] text-white font-semibold py-3 rounded-xl hover:bg-[#7C75FF] transition-all text-sm"
          >
            {t("results.home")}
          </button>
        </div>

        {/* History */}
        {history.length > 1 && (
          <div>
            <h2 className="text-[#F0F0FF] text-sm font-semibold mb-3">{t("results.history")}</h2>
            <div className="space-y-2">
              {history.slice(0, 5).map((s) => (
                <div key={s.id} className="bg-[#13131A] border border-[#1E1E2E] rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-[#F0F0FF] text-xs font-medium">
                      {s.mode === "trainer" ? t("results.trainer_short") : t("results.consul_short")}
                    </span>
                    <span className="text-[#8B8BA7] text-xs ml-2">{t("results.questions_count", { n: s.question_count })}</span>
                  </div>
                  <div className="text-right">
                    {s.scores && (
                      <span className="text-[#6C63FF] text-xs font-bold">{s.scores.overall?.toFixed(1)}/10</span>
                    )}
                    <span className="text-[#8B8BA7] text-xs ml-2">{formatDuration(s.duration_seconds)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
