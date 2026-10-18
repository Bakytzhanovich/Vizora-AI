"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  getAdminFeedback,
  type AdminFeedbackItem,
  type AdminFeedbackKind,
  type AdminFeedbackStats,
} from "@/lib/admin-api";

type Filter = AdminFeedbackKind | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "bug", label: "Ошибки" },
  { id: "idea", label: "Идеи" },
  { id: "question", label: "Вопросы" },
  { id: "session", label: "Оценки тренировок" },
];

const KIND_LABELS: Record<AdminFeedbackKind, string> = {
  idea: "Идея",
  bug: "Ошибка",
  question: "Вопрос",
  session: "Оценка тренировки",
};

const formatDate = (iso: string | null) =>
  iso ? new Date(iso.endsWith("Z") ? iso : `${iso}Z`).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : "";

function Summary({ stats }: { stats: AdminFeedbackStats }) {
  const rated = Object.values(stats.ratings).reduce((a, b) => a + b, 0);
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <div className="rounded-xl border border-[#242837] bg-[#12141C] p-4">
        <p className="text-sm text-[#81889B]">Всего отзывов</p>
        <p className="mt-2 text-2xl font-bold text-white">{stats.total}</p>
        <p className="mt-1 text-xs text-[#81889B]">+{stats.new_7d} за 7 дней</p>
      </div>
      <div className="rounded-xl border border-[#242837] bg-[#12141C] p-4">
        <p className="text-sm text-[#81889B]">Ошибки</p>
        <p className="mt-2 text-2xl font-bold text-white">{stats.by_kind.bug}</p>
        <p className="mt-1 text-xs text-[#81889B]">
          {stats.by_kind.idea} идей · {stats.by_kind.question} вопросов
        </p>
      </div>
      <div className="col-span-2 rounded-xl border border-[#242837] bg-[#12141C] p-4">
        <p className="text-sm text-[#81889B]">Оценка тренировок</p>
        <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-3">
          <p className="text-2xl font-bold text-white">
            {stats.avg_rating ?? "—"}
            <span className="text-sm font-normal text-[#81889B]"> / 5 · оценок: {rated}</span>
          </p>
          <div className="flex flex-1 items-end gap-2" aria-label="Распределение оценок">
            {(["1", "2", "3", "4", "5"] as const).map((r) => (
              <div key={r} className="flex min-w-8 flex-1 flex-col items-center gap-1">
                <span className="text-xs text-[#A3A8B8]">{stats.ratings[r]}</span>
                <div className="h-10 w-full rounded bg-[#1B1E29] flex items-end overflow-hidden">
                  <div
                    className={`w-full ${Number(r) <= 2 ? "bg-red-500" : Number(r) === 3 ? "bg-amber-400" : "bg-green-500"}`}
                    style={{ height: `${rated ? (stats.ratings[r] / rated) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-[#81889B]">{r}★</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedbackContent() {
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<AdminFeedbackItem[]>([]);
  const [stats, setStats] = useState<AdminFeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminFeedback(filter);
      setItems(data.items);
      setStats(data.stats);
    } catch {
      setError("Не удалось загрузить отзывы");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      {stats && <Summary stats={stats} />}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр отзывов">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition-colors ${
              filter === f.id ? "bg-blue-600 text-white" : "bg-[#12141C] border border-[#242837] text-[#A3A8B8] hover:text-[#F5F7FF]"
            }`}
          >
            {f.label}
            {stats && <span className="ml-1.5 opacity-70">{f.id === "all" ? stats.total : stats.by_kind[f.id]}</span>}
          </button>
        ))}
        <button
          onClick={load}
          className="min-h-11 rounded-lg px-4 text-sm font-semibold border border-[#242837] text-[#A3A8B8] hover:text-[#F5F7FF] ml-auto"
        >
          Обновить
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-[#81889B]">Загрузка…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-[#242837] bg-[#12141C] p-8 text-center text-sm text-[#81889B]">
          Отзывов пока нет
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((f) => (
            <div key={f.id} className="rounded-xl border border-[#242837] bg-[#12141C] p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                    f.kind === "bug" ? "bg-red-500/15 text-red-300" : "bg-blue-500/15 text-blue-300"
                  }`}
                >
                  {KIND_LABELS[f.kind]}
                </span>
                {f.rating !== null && (
                  <span className={f.rating <= 2 ? "text-red-400" : f.rating === 3 ? "text-amber-400" : "text-green-400"}>
                    {"★".repeat(f.rating)}
                    <span className="text-[#3A3F52]">{"★".repeat(5 - f.rating)}</span>
                  </span>
                )}
                <a href={`mailto:${f.email}`} className="text-[#A3A8B8] hover:text-blue-300 break-all">
                  {f.email}
                </a>
                <span className="text-xs text-[#81889B] sm:ml-auto">
                  {formatDate(f.created_at)}
                  {f.page ? ` · ${f.page}` : ""}
                </span>
              </div>
              {f.message ? (
                <p className="whitespace-pre-line text-sm text-[#F5F7FF]">{f.message}</p>
              ) : (
                <p className="text-sm text-[#81889B]">Без комментария</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FeedbackAdmin() {
  return (
    <AdminShell title="Отзывы" subtitle="Что пишут студенты и как оценивают тренировки." active="Feedback">
      <FeedbackContent />
    </AdminShell>
  );
}
