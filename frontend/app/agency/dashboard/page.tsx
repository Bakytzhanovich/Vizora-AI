"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Users, ChevronRight } from "lucide-react";
import { AgencyLayout } from "@/components/agency/AgencyLayout";
import { StatsCard } from "@/components/agency/StatsCard";
import { AlertCard } from "@/components/agency/AlertCard";
import { AddStudentModal } from "@/components/agency/AddStudentModal";
import { AIInsightBox } from "@/components/agency/AIInsightBox";
import { BillingBadge } from "@/components/agency/BillingBadge";
import {
  agencyGetMe,
  agencyGetAnalytics,
  agencyGetAlerts,
  agencyGetStudents,
  getAgencyAuth,
  type AgencyMe,
  type AgencyAnalytics,
  type AgencyAlert,
  type AgencyStudent,
} from "@/lib/agency-api";

export default function AgencyDashboardPage() {
  const [me, setMe] = useState<AgencyMe | null>(null);
  const [analytics, setAnalytics] = useState<AgencyAnalytics | null>(null);
  const [alerts, setAlerts] = useState<AgencyAlert[]>([]);
  const [recentStudents, setRecentStudents] = useState<AgencyStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [role, setRole] = useState<"admin" | "manager">("admin");

  const loadData = async () => {
    try {
      const auth = getAgencyAuth();
      setRole(auth?.role ?? "admin");

      const [meData, analyticsData, alertsData, studentsData] = await Promise.all([
        agencyGetMe(),
        agencyGetAnalytics(),
        agencyGetAlerts(),
        agencyGetStudents("", "name"),
      ]);
      setMe(meData);
      setAnalytics(analyticsData);
      setAlerts(alertsData.alerts);
      setRecentStudents(studentsData.students.slice(0, 5));
      setRole(meData.role);
    } catch {
      /* handled by interceptor */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const aiInsight = (() => {
    if (!analytics) return null;
    const weakest = analytics.weak_topics[0];
    if (weakest && weakest.avg_score < 6) {
      return {
        insight: `У большинства студентов слабое место — "${weakest.topic}" (средний балл ${weakest.avg_score}/10). Это влияет на шансы успешного интервью.`,
        recommendation: `Организуйте групповую сессию отработки "${weakest.topic}". Попросите студентов пройти симулятор минимум 3 раза перед интервью.`,
      };
    }
    const criticalAlerts = alerts.filter((a) => a.type === "critical");
    if (criticalAlerts.length > 0) {
      return {
        insight: `${criticalAlerts.length} студентов имеют критические предупреждения — интервью скоро, а подготовка не начата.`,
        recommendation: `Немедленно свяжитесь с этими студентами и обеспечьте доступ к симулятору.`,
      };
    }
    return {
      insight: `Средняя готовность студентов: ${analytics.avg_readiness}%. Продолжайте поддерживать активность команды.`,
      recommendation: `Следите за студентами с готовностью ниже 40% — им нужна дополнительная поддержка.`,
    };
  })();

  if (loading) {
    return (
      <AgencyLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-9 h-9 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </AgencyLayout>
    );
  }

  return (
    <AgencyLayout>
      {showModal && (
        <AddStudentModal
          onClose={() => setShowModal(false)}
          onAdded={() => { setShowModal(false); loadData(); }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          {role === "manager" ? (
            <>
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-0.5">
                Менеджер • {me?.name}
              </p>
              <h1 className="text-2xl font-bold text-gray-900">{me?.member_name ?? me?.name}</h1>
            </>
          ) : (
            <h1 className="text-2xl font-bold text-gray-900">{me?.name}</h1>
          )}
          <p className="text-sm text-gray-500 mt-0.5">{me?.student_count} студентов</p>
          {role === "admin" && me?.billing && (
            <div className="mt-2">
              <BillingBadge billing={me.billing} />
            </div>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition"
        >
          <Plus size={16} />
          Добавить студента
        </button>
      </div>

      {/* Unassigned banner (admin only) */}
      {role === "admin" && analytics && analytics.unassigned_students > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 mb-5 flex items-center gap-3">
          <span className="text-amber-600 text-lg">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {analytics.unassigned_students} студентов без менеджера
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Назначьте менеджеров в разделе{" "}
              <Link href="/agency/students?filter=unassigned" className="underline font-medium">Студенты → Без менеджера</Link>
            </p>
          </div>
        </div>
      )}

      {/* Manager unassigned banner */}
      {role === "manager" && analytics && analytics.unassigned_students > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 mb-5 flex items-center gap-3">
          <span className="text-amber-600 text-lg">⚠️</span>
          <p className="text-sm text-amber-800">
            У агентства {analytics.unassigned_students} студентов без назначения — свяжитесь с администратором
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard title="Студентов" value={analytics?.total_students ?? 0} icon="👥" color="blue" />
        <StatsCard title="Активны сегодня" value={analytics?.active_today ?? 0} icon="⚡" color="green" />
        <StatsCard title="Средняя готовность" value={`${analytics?.avg_readiness ?? 0}%`} icon="📊" color="purple" />
        <StatsCard
          title="Предупреждений"
          value={alerts.length}
          icon="🔔"
          color={alerts.some((a) => a.type === "critical") ? "amber" : "blue"}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Alerts + recent students */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Предупреждения</h2>
            {alerts.length > 0 && (
              <Link href="/agency/students" className="text-sm text-blue-600 hover:underline">
                Все студенты
              </Link>
            )}
          </div>
          {alerts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-10 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm text-gray-500">Всё в порядке</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 6).map((alert, i) => (
                <AlertCard key={`${alert.student_id}-${i}`} alert={alert} />
              ))}
            </div>
          )}

          {recentStudents.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3 mt-6">
                <h2 className="font-semibold text-gray-900">
                  {role === "manager" ? "Мои студенты" : "Студенты"}
                </h2>
                <Link href="/agency/students" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  Все <ChevronRight size={14} />
                </Link>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {recentStudents.map((s) => (
                  <Link
                    key={s.id}
                    href={`/agency/students/${s.id}`}
                    className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`text-sm font-bold ${s.readiness >= 70 ? "text-emerald-600" : s.readiness >= 40 ? "text-amber-600" : "text-red-500"}`}>
                          {s.readiness}%
                        </p>
                        <p className="text-xs text-gray-400">готовность</p>
                      </div>
                      <ChevronRight size={14} className="text-gray-300" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {aiInsight && (
            <AIInsightBox insight={aiInsight.insight} recommendation={aiInsight.recommendation} />
          )}

          {analytics && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Распределение готовности</h3>
              {[
                { label: "Высокая (70%+)", count: analytics.readiness_distribution.high, color: "bg-emerald-500" },
                { label: "Средняя (40–69%)", count: analytics.readiness_distribution.medium, color: "bg-amber-400" },
                { label: "Низкая (< 40%)", count: analytics.readiness_distribution.low, color: "bg-red-400" },
              ].map(({ label, count, color }) => (
                <div key={label} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-bold text-gray-900">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color}`}
                      style={{ width: analytics.total_students > 0 ? `${(count / analytics.total_students) * 100}%` : "0%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Быстрые действия</h3>
            <div className="space-y-2">
              <button
                onClick={() => setShowModal(true)}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-200 text-sm font-medium text-blue-600 hover:bg-blue-50 transition"
              >
                <Users size={15} />
                Добавить студента
              </button>
              <Link
                href="/agency/analytics"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                <ChevronRight size={15} />
                Полная аналитика
              </Link>
              {role === "admin" && (
                <Link
                  href="/agency/team"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  <ChevronRight size={15} />
                  Управление командой
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </AgencyLayout>
  );
}
