"use client";

import { useEffect, useState } from "react";
import { AgencyLayout } from "@/components/agency/AgencyLayout";
import { StatsCard } from "@/components/agency/StatsCard";
import { AnalyticsChart } from "@/components/agency/AnalyticsChart";
import { AIInsightBox } from "@/components/agency/AIInsightBox";
import { agencyGetAnalytics, type AgencyAnalytics } from "@/lib/agency-api";

export default function AgencyAnalyticsPage() {
  const [data, setData] = useState<AgencyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    agencyGetAnalytics()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

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

  const weeklyMax = Math.max(...data.weekly_activity.map((d) => d.active_users), 1);

  const weeklyItems = data.weekly_activity.map((d) => ({
    label: new Date(d.date).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric" }),
    value: d.active_users,
    color: "#2563EB",
  }));

  const weakTopicItems = data.weak_topics.map((t) => ({
    label: t.topic,
    value: t.avg_score,
    color: t.avg_score >= 7 ? "#10B981" : t.avg_score >= 5 ? "#F59E0B" : "#EF4444",
  }));

  const distItems = [
    { label: "Высокая готовность (70%+)", value: data.readiness_distribution.high, color: "#10B981" },
    { label: "Средняя готовность (40–69%)", value: data.readiness_distribution.medium, color: "#F59E0B" },
    { label: "Низкая готовность (< 40%)", value: data.readiness_distribution.low, color: "#EF4444" },
  ];

  const aiInsight = (() => {
    const weakest = data.weak_topics[0];
    if (weakest && weakest.avg_score < 6) {
      return {
        insight: `Главная проблемная область — "${weakest.topic}". Средний балл ${weakest.avg_score}/10 ниже допустимого порога.`,
        recommendation: `Увеличьте количество практических сессий по этой теме. Цель: довести средний балл до 7.0+.`,
      };
    }
    if (data.readiness_distribution.low > data.total_students * 0.3) {
      return {
        insight: `${data.readiness_distribution.low} студентов имеют низкую готовность (< 40%). Это ${Math.round((data.readiness_distribution.low / data.total_students) * 100)}% группы.`,
        recommendation: `Проведите индивидуальные консультации с отстающими студентами. Приоритет — заполнение профиля и начало симулятора.`,
      };
    }
    return {
      insight: `Средняя готовность группы — ${data.avg_readiness}%. Всего проведено ${data.sim_sessions_total} симуляций интервью.`,
      recommendation: `Поддерживайте активность: рекомендуйте студентам заходить в платформу ежедневно.`,
    };
  })();

  return (
    <AgencyLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Аналитика</h1>
        <p className="text-sm text-gray-500 mt-0.5">Статистика по всем студентам</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard title="Студентов" value={data.total_students} icon="👥" color="blue" />
        <StatsCard title="Активны сегодня" value={data.active_today} icon="⚡" color="green" />
        <StatsCard title="Средняя готовность" value={`${data.avg_readiness}%`} icon="📊" color="purple" />
        <StatsCard title="Всего симуляций" value={data.sim_sessions_total} icon="🎤" color="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Weekly activity */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Активность за 7 дней</h2>
          <p className="text-xs text-gray-400 mb-5">Кол-во уникальных студентов в день</p>
          {data.weekly_activity.every((d) => d.active_users === 0) ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">
              Нет данных
            </div>
          ) : (
            <AnalyticsChart items={weeklyItems} max={weeklyMax} unit=" чел." />
          )}
        </div>

        {/* Readiness distribution */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Распределение готовности</h2>
          <p className="text-xs text-gray-400 mb-5">Студентов в каждой категории</p>
          <AnalyticsChart items={distItems} max={data.total_students || 1} unit=" студ." />

          {/* Summary pills */}
          <div className="flex gap-2 mt-5 flex-wrap">
            {[
              { label: "Высокая", count: data.readiness_distribution.high, color: "bg-emerald-100 text-emerald-700" },
              { label: "Средняя", count: data.readiness_distribution.medium, color: "bg-amber-100 text-amber-700" },
              { label: "Низкая", count: data.readiness_distribution.low, color: "bg-red-100 text-red-600" },
            ].map(({ label, count, color }) => (
              <span key={label} className={`text-xs font-semibold px-3 py-1 rounded-full ${color}`}>
                {label}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Weak topics */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Слабые места в симуляторе</h2>
          <p className="text-xs text-gray-400 mb-5">Средний балл по критериям (из 10)</p>
          {data.weak_topics.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">
              Недостаточно данных
            </div>
          ) : (
            <AnalyticsChart items={weakTopicItems} max={10} unit="/10" />
          )}
        </div>

        {/* AI Insight */}
        <AIInsightBox insight={aiInsight.insight} recommendation={aiInsight.recommendation} />
      </div>
    </AgencyLayout>
  );
}
