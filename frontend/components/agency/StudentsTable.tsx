"use client";

import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import type { AgencyStudent } from "@/lib/agency-api";
import { ReadinessBar } from "./ReadinessBar";

interface Props {
  students: AgencyStudent[];
}

function formatLastActive(iso: string | null) {
  if (!iso) return "Никогда";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Вчера";
  if (diff < 7) return `${diff} дн. назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function InterviewBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-gray-400 text-xs">—</span>;
  if (days < 0) return <span className="text-xs text-gray-400">Прошло</span>;
  if (days <= 3) return <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{days}д!</span>;
  if (days <= 7) return <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{days}д</span>;
  return <span className="text-xs text-gray-600">{days}д</span>;
}

export function StudentsTable({ students }: Props) {
  if (students.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16 px-4">
        <p className="text-3xl mb-3">👥</p>
        <p className="text-gray-500 text-sm">Студенты не найдены</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="hidden md:grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        <span>Студент</span>
        <span>Готовность</span>
        <span>Документы</span>
        <span>Симулятор</span>
        <span>Интервью</span>
        <span>Активность</span>
        <span />
      </div>

      <div className="divide-y divide-gray-50">
        {students.map((s) => (
          <Link
            key={s.id}
            href={`/agency/students/${s.id}`}
            className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-4 hover:bg-gray-50 transition-colors items-center"
          >
            {/* Name + university */}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
              <p className="text-xs text-gray-400 truncate">{s.email}</p>
              {s.university && (
                <p className="text-xs text-gray-400 truncate hidden sm:block">{s.university}</p>
              )}
            </div>

            {/* Readiness bar */}
            <div className="min-w-0">
              <ReadinessBar value={s.readiness} />
            </div>

            {/* Docs */}
            <div>
              <span className={`text-sm font-semibold ${s.documents_pct >= 100 ? "text-emerald-600" : s.documents_pct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                {s.documents_pct}%
              </span>
            </div>

            {/* Simulator */}
            <div className="text-sm text-gray-700">
              {s.simulator_sessions} сессий
              {s.simulator_avg_score > 0 && (
                <span className="block text-xs text-gray-400">{s.simulator_avg_score.toFixed(1)}/10</span>
              )}
            </div>

            {/* Interview */}
            <div>
              <InterviewBadge days={s.days_until_interview} />
            </div>

            {/* Last active */}
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock size={12} />
              {formatLastActive(s.last_active)}
            </div>

            <ChevronRight size={16} className="text-gray-300 hidden md:block" />
          </Link>
        ))}
      </div>
    </div>
  );
}
