"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { AgencyLayout } from "@/components/agency/AgencyLayout";
import { ReadinessBar } from "@/components/agency/ReadinessBar";
import {
  agencyGetMemberStudents,
  agencyDeactivateMember,
  agencyAssignStudents,
  agencyGetTeam,
  type AgencyTeamMember,
} from "@/lib/agency-api";

function InterviewBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-gray-400 text-xs">—</span>;
  if (days < 0) return <span className="text-xs text-gray-400">Прошло</span>;
  if (days <= 3) return <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{days}д!</span>;
  if (days <= 7) return <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{days}д</span>;
  return <span className="text-xs text-gray-600">{days}д</span>;
}

interface StudentRow {
  id: string;
  email: string;
  name: string;
  readiness: number;
  simulator_sessions: number;
  simulator_avg_score: number;
  interview_date: string | null;
  days_until_interview: number | null;
}

export default function MemberDetailPage() {
  const { member_id } = useParams<{ member_id: string }>();
  const router = useRouter();

  const [member, setMember] = useState<AgencyTeamMember | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [managers, setManagers] = useState<AgencyTeamMember[]>([]);
  const [showReassign, setShowReassign] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [studentsData, teamData] = await Promise.all([
        agencyGetMemberStudents(member_id),
        agencyGetTeam(),
      ]);
      setStudents(studentsData.students);
      setMember(studentsData.member as AgencyTeamMember || null);
      setManagers(teamData.members.filter((m) => m.role === "manager" && m.id !== member_id && m.status === "active"));
      // Update member info from team list
      const found = teamData.members.find((m) => m.id === member_id);
      if (found) setMember(found);
    } catch {
      router.back();
    } finally {
      setLoading(false);
    }
  }, [member_id, router]);

  useEffect(() => { load(); }, [load]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s.id)));
    }
  };

  const handleDeactivate = async () => {
    setBusy(true);
    try {
      await agencyDeactivateMember(member_id);
      router.push("/agency/team");
    } catch (e: unknown) {
      alert((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleReassign = async (targetManagerId: string) => {
    setBusy(true);
    try {
      await agencyAssignStudents(Array.from(selectedIds), targetManagerId);
      setSelectedIds(new Set());
      setShowReassign(false);
      load();
    } catch {
      alert("Ошибка переназначения");
    } finally {
      setBusy(false);
    }
  };

  const handleUnassignAll = async () => {
    if (!students.length) return;
    setBusy(true);
    try {
      await agencyAssignStudents(students.map((s) => s.id), "unassign");
      load();
    } catch {
      alert("Ошибка");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AgencyLayout requireAdmin>
        <div className="flex items-center justify-center h-64">
          <div className="w-9 h-9 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </AgencyLayout>
    );
  }

  if (!member) return null;

  return (
    <AgencyLayout requireAdmin>
      {/* Deactivate confirm */}
      {showDeactivate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-900 mb-2">Деактивировать {member.name}?</h3>
            <p className="text-sm text-gray-500 mb-5">Их {students.length} студентов перейдут в «Без менеджера».</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeactivate(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Отмена</button>
              <button onClick={handleDeactivate} disabled={busy} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition">Деактивировать</button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign modal */}
      {showReassign && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-900 mb-4">Переназначить {selectedIds.size} студентов</h3>
            <div className="space-y-2">
              {managers.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleReassign(m.id)}
                  disabled={busy}
                  className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-xl text-sm hover:bg-blue-50 hover:border-blue-300 transition text-left"
                >
                  <span className="font-medium text-gray-900">{m.name}</span>
                  <span className="text-gray-400 text-xs">{m.students_count} студ.</span>
                </button>
              ))}
              {managers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Нет других менеджеров</p>
              )}
            </div>
            <button onClick={() => setShowReassign(false)} className="mt-4 w-full py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Отмена</button>
          </div>
        </div>
      )}

      <button onClick={() => router.push("/agency/team")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors">
        <ArrowLeft size={16} />
        Назад к команде
      </button>

      {/* Member header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-blue-600 font-bold text-xl">{member.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{member.name}</h1>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">👤 Менеджер</span>
              {member.status === "active" && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Активен</span>}
            </div>
            <p className="text-sm text-gray-500">{member.email}</p>
            {member.joined_at && (
              <p className="text-xs text-gray-400 mt-1">
                В команде с {new Date(member.joined_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={() => setShowDeactivate(true)}
              className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition"
            >
              Деактивировать
            </button>
            {students.length > 0 && (
              <button
                onClick={handleUnassignAll}
                disabled={busy}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
              >
                Снять всех студентов
              </button>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Студентов</p>
            <p className="text-2xl font-black text-gray-900">{students.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Последний вход</p>
            <p className="text-sm font-semibold text-gray-700 mt-1">
              {member.last_login ? new Date(member.last_login).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "Никогда"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Средняя готовность</p>
            <p className="text-sm font-semibold text-gray-700 mt-1">
              {students.length > 0
                ? `${Math.round(students.reduce((s, x) => s + x.readiness, 0) / students.length)}%`
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Students table */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900">Студенты менеджера ({students.length})</h2>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Выбрано: {selectedIds.size}</span>
            <button
              onClick={() => setShowReassign(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition"
            >
              <Users size={14} />
              Переназначить
            </button>
          </div>
        )}
      </div>

      {students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16">
          <p className="text-3xl mb-3">🎓</p>
          <p className="text-gray-500 text-sm">Нет студентов</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="hidden md:grid grid-cols-[32px_2fr_1.5fr_1fr_1fr_1fr] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={selectedIds.size === students.length}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </label>
            <span>Студент</span>
            <span>Готовность</span>
            <span>Симулятор</span>
            <span>Интервью</span>
            <span>Балл</span>
          </div>

          <div className="divide-y divide-gray-50">
            {students.map((s) => (
              <div
                key={s.id}
                className={`grid grid-cols-1 md:grid-cols-[32px_2fr_1.5fr_1fr_1fr_1fr] gap-4 px-5 py-4 items-center transition-colors hover:bg-gray-50 ${
                  selectedIds.has(s.id) ? "bg-blue-50" : ""
                }`}
              >
                <label className="flex items-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleSelect(s.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                  <p className="text-xs text-gray-400 truncate">{s.email}</p>
                </div>
                <ReadinessBar value={s.readiness} />
                <p className="text-sm text-gray-700">{s.simulator_sessions} сессий</p>
                <InterviewBadge days={s.days_until_interview} />
                <p className={`text-sm font-semibold ${s.simulator_avg_score >= 7 ? "text-emerald-600" : s.simulator_avg_score >= 5 ? "text-amber-600" : s.simulator_avg_score > 0 ? "text-red-500" : "text-gray-400"}`}>
                  {s.simulator_avg_score > 0 ? `${s.simulator_avg_score}/10` : "—"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </AgencyLayout>
  );
}
