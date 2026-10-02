"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Globe, BookOpen, DollarSign, KeyRound, X } from "lucide-react";
import { AgencyLayout } from "@/components/agency/AgencyLayout";
import { ReadinessBar } from "@/components/agency/ReadinessBar";
import { agencyGetStudent, agencyIssueStudentPassword, type AgencyStudentDetail } from "@/lib/agency-api";
import { StudentAccessCard } from "@/components/agency/StudentAccessCard";
import { criteriaKeys, criterionFraction, criterionLabel } from "@/lib/englishLevel";

const TABS = ["Обзор", "Английский", "Симулятор", "Документы", "Риски"] as const;
type Tab = (typeof TABS)[number];

const ENGLISH_MAP: Record<string, string> = { weak: "Слабый", medium: "Средний", good: "Хороший" };
const ENGLISH_CRITERIA_LABELS: Record<string, string> = {
  fluency: "Беглость",
  accuracy: "Точность",
  vocabulary: "Словарный запас",
  grammar: "Грамматика",
  coherence: "Связность речи",
  development: "Развёрнутость ответов",
};
// Colour by the visa interview bar (B1), as in EnglishLevelBadge; older
// results scored criteria 0-10.
const CRITERION_TONES = [
  { text: "text-red-500", bar: "bg-red-400" },
  { text: "text-amber-600", bar: "bg-amber-400" },
  { text: "text-emerald-600", bar: "bg-emerald-500" },
];
function criterionTone(value: string | number) {
  if (typeof value === "number") return CRITERION_TONES[value >= 7 ? 2 : value >= 5 ? 1 : 0];
  const base = value.replace("+", "");
  return CRITERION_TONES[base === "A1" || base === "A2" ? 0 : base === "B1" ? 1 : 2];
}
const FINANCE_MAP: Record<string, string> = { self: "Свои", parents: "Родители", scholarship: "Стипендия" };
const RISK_COLORS: Record<string, string> = {
  high: "text-red-600 bg-red-50 border-red-200",
  medium: "text-amber-600 bg-amber-50 border-amber-200",
  low: "text-emerald-600 bg-emerald-50 border-emerald-200",
};

const ROADMAP_LABELS: Record<string, string> = {
  profile: "Профиль", documents: "Документы", ds160: "DS-160", sevis: "SEVIS",
  appointment: "Запись", interview_prep: "Подготовка", interview: "Интервью",
  visa: "Виза", flight: "Перелёт", arrival: "Приезд", ssn: "SSN",
  work: "Работа", taxes: "Налоги", return: "Возвращение",
};

function daysUntil(dateStr: string | null) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<AgencyStudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("Обзор");
  // "confirm" asks first: issuing a new password signs the old one out.
  const [access, setAccess] = useState<"confirm" | { password: string; link: string } | null>(null);
  const [accessError, setAccessError] = useState("");
  const [issuing, setIssuing] = useState(false);

  const issuePassword = async () => {
    setIssuing(true);
    setAccessError("");
    try {
      const res = await agencyIssueStudentPassword(id);
      setAccess({ password: res.password, link: res.invite_link });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setAccessError(msg || "Не удалось выдать пароль");
    } finally {
      setIssuing(false);
    }
  };

  useEffect(() => {
    agencyGetStudent(id)
      .then(setData)
      .catch(() => router.back())
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <AgencyLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-9 h-9 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </AgencyLayout>
    );
  }

  if (!data) return null;
  const { student, readiness, documents_pct, simulator_sessions, simulator_avg_score, simulator_scores, risk_profile, roadmap_completed } = data;
  const englishTest = data.english_test ?? null;
  // The API returns the stored {risks: [...]} object (or [] without a profile);
  // treating it as an array crashed this whole page on the Risks tab.
  const risks = Array.isArray(risk_profile) ? risk_profile : risk_profile?.risks ?? [];
  const days = daysUntil(student.interview_date);

  return (
    <AgencyLayout>
      {access && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <KeyRound size={18} className="text-blue-600" />
                <h3 className="font-semibold text-gray-900">Доступ для студента</h3>
              </div>
              <button
                onClick={() => { setAccess(null); setAccessError(""); }}
                aria-label="Закрыть"
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-5">
              {access === "confirm" ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-700">
                    Сгенерировать новый пароль для {student.name}? Старый пароль перестанет работать.
                  </p>
                  {accessError && <p className="text-sm text-red-500">{accessError}</p>}
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setAccess(null); setAccessError(""); }}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={issuePassword}
                      disabled={issuing}
                      className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      {issuing ? "Генерируем..." : "Сгенерировать"}
                    </button>
                  </div>
                </div>
              ) : (
                <StudentAccessCard name={student.name} email={student.email} link={access.link} password={access.password} />
              )}
            </div>
          </div>
        </div>
      )}
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors"
      >
        <ArrowLeft size={16} />
        Назад к списку
      </button>

      {/* Student header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-blue-600 font-bold text-xl">
              {student.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{student.name}</h1>
            <p className="text-sm text-gray-500">{student.email}</p>
            {data.can_issue_password && (
              <button
                onClick={() => setAccess("confirm")}
                className="mt-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <KeyRound size={12} />
                Выдать новый пароль для входа
              </button>
            )}
            {student.university && (
              <p className="text-sm text-gray-600 mt-0.5 flex items-center gap-1">
                <BookOpen size={13} className="text-gray-400" />
                {student.university}, {student.course_year} курс
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 flex items-center gap-1">
                <Globe size={11} />
                {student.country}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                {/* A measured level beats the self-reported one from onboarding */}
                🇺🇸 {englishTest ? `${englishTest.level} (тест)` : ENGLISH_MAP[student.english_level] ?? student.english_level}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 flex items-center gap-1">
                <DollarSign size={11} />
                {FINANCE_MAP[student.financial_source] ?? student.financial_source}
              </span>
              {student.travel_history && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">
                  ✓ Есть история поездок
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            {student.interview_date && (
              <div>
                <div className="flex items-center gap-1.5 justify-end text-sm text-gray-600">
                  <Calendar size={14} />
                  {new Date(student.interview_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                </div>
                {days !== null && days > 0 && (
                  <p className={`text-sm font-bold mt-0.5 ${days <= 7 ? "text-red-600" : "text-gray-700"}`}>
                    {days} дн. до интервью
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Overall readiness */}
        <div className="mt-5 pt-5 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Общая готовность</span>
            <span className={`text-lg font-bold ${readiness >= 70 ? "text-emerald-600" : readiness >= 40 ? "text-amber-600" : "text-red-500"}`}>
              {readiness}%
            </span>
          </div>
          <ReadinessBar value={readiness} showValue={false} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab: Обзор */}
      {tab === "Обзор" && (
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs text-gray-500 font-medium mb-1">Документы</p>
            <p className={`text-3xl font-bold mb-2 ${documents_pct >= 100 ? "text-emerald-600" : documents_pct >= 50 ? "text-amber-600" : "text-red-500"}`}>
              {documents_pct}%
            </p>
            <ReadinessBar value={documents_pct} showValue={false} />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs text-gray-500 font-medium mb-1">Симулятор</p>
            <p className="text-3xl font-bold text-blue-600 mb-1">{simulator_sessions}</p>
            <p className="text-sm text-gray-500">сессий пройдено</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs text-gray-500 font-medium mb-1">Средний балл</p>
            <p className={`text-3xl font-bold mb-1 ${simulator_avg_score >= 7 ? "text-emerald-600" : simulator_avg_score >= 5 ? "text-amber-600" : "text-red-500"}`}>
              {simulator_avg_score > 0 ? simulator_avg_score.toFixed(1) : "—"}
            </p>
            <p className="text-sm text-gray-500">{simulator_avg_score > 0 ? "из 10" : "нет сессий"}</p>
          </div>

          {/* Roadmap progress */}
          <div className="sm:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Шаги Roadmap</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ROADMAP_LABELS).map(([key, label]) => {
                const done = roadmap_completed.includes(key);
                return (
                  <span
                    key={key}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                      done
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-gray-50 text-gray-400 border border-gray-200"
                    }`}
                  >
                    {done ? "✓ " : ""}{label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Английский */}
      {tab === "Английский" && (
        !englishTest ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-10 text-center">
            <p className="text-2xl mb-2">🎯</p>
            <p className="text-sm text-gray-700 font-medium">Студент ещё не проверял уровень английского</p>
            <p className="text-xs text-gray-400 mt-1">
              Проверка уровня — в симуляторе, занимает 3–4 минуты. Уровень в профиле сейчас указан самим студентом:{" "}
              {ENGLISH_MAP[student.english_level] ?? student.english_level}.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center justify-center text-center">
              <p className="text-xs text-gray-500 font-medium mb-1">Уровень по тесту</p>
              <p className="text-5xl font-black text-blue-600 mt-1">{englishTest.level}</p>
              <p className="text-gray-700 font-medium">{englishTest.level_title}</p>
              <p className="text-gray-400 text-xs mt-2">
                Тестов пройдено: {englishTest.tests_taken}
                {englishTest.tested_at &&
                  ` · последний ${new Date(englishTest.tested_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`}
              </p>
              {englishTest.summary_ru && <p className="text-sm text-gray-600 mt-4 leading-relaxed">{englishTest.summary_ru}</p>}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Оценка по критериям</h3>
              <div className="space-y-4">
                {criteriaKeys(englishTest.criteria ?? {}).map((key) => {
                  const value = englishTest.criteria?.[key] ?? null;
                  const tone = value == null ? null : criterionTone(value);
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-gray-600">{ENGLISH_CRITERIA_LABELS[key]}</span>
                        <span className={`font-bold ${tone?.text ?? "text-gray-400"}`}>{criterionLabel(value) ?? "—"}</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${tone?.bar ?? ""}`}
                          style={{ width: `${criterionFraction(value) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 mt-4">
                Примерный уровень по разговорной речи. Для визового интервью обычно достаточно B1.
              </p>
            </div>
          </div>
        )
      )}

      {/* Tab: Симулятор */}
      {tab === "Симулятор" && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Результаты по критериям</h3>
            {simulator_sessions === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Нет завершённых сессий</p>
            ) : (
              <div className="space-y-4">
                {[
                  { key: "confidence", label: "Уверенность" },
                  { key: "language", label: "Английский" },
                  { key: "content", label: "Содержание" },
                ].map(({ key, label }) => {
                  const score = (simulator_scores as Record<string, number>)[key] ?? 0;
                  const pct = Math.round(score * 10);
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-gray-600">{label}</span>
                        <span className={`font-bold ${score >= 7 ? "text-emerald-600" : score >= 5 ? "text-amber-600" : "text-red-500"}`}>
                          {score.toFixed(1)}/10
                        </span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${score >= 7 ? "bg-emerald-500" : score >= 5 ? "bg-amber-400" : "bg-red-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center justify-center">
            <p className="text-5xl font-black text-blue-600 mb-2">
              {simulator_avg_score > 0 ? simulator_avg_score.toFixed(1) : "—"}
            </p>
            <p className="text-gray-500 text-sm">средний балл</p>
            <p className="text-gray-400 text-xs mt-1">{simulator_sessions} сессий</p>
          </div>
        </div>
      )}

      {/* Tab: Документы */}
      {tab === "Документы" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-gray-900">Прогресс документов</h3>
            <span className={`text-lg font-bold ${documents_pct >= 100 ? "text-emerald-600" : documents_pct >= 50 ? "text-amber-600" : "text-red-500"}`}>
              {documents_pct}%
            </span>
          </div>
          <ReadinessBar value={documents_pct} showValue={false} />
          <p className="text-sm text-gray-500 mt-4">
            {documents_pct >= 100
              ? "✅ Все обязательные документы собраны"
              : documents_pct >= 50
              ? "⚠️ Часть документов ещё не готова"
              : "❌ Документы нуждаются в серьёзной работе"}
          </p>
        </div>
      )}

      {/* Tab: Риски */}
      {tab === "Риски" && (
        <div className="space-y-3">
          {risks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-10 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm text-gray-500">
                {Array.isArray(risk_profile) ? "Профиль рисков ещё не сформирован" : "Серьёзных рисков не выявлено"}
              </p>
            </div>
          ) : (
            risks.map((risk, i) => (
              <div
                key={i}
                className={`rounded-xl border px-5 py-4 ${RISK_COLORS[risk.severity] ?? RISK_COLORS.medium}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wide">
                    {risk.severity === "high" ? "Высокий риск" : risk.severity === "medium" ? "Средний риск" : "Низкий риск"}
                  </span>
                </div>
                <p className="text-sm font-semibold">{risk.label_ru ?? risk.type}</p>
                {risk.advice_ru && <p className="text-sm mt-0.5 opacity-80">{risk.advice_ru}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </AgencyLayout>
  );
}
