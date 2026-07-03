"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, ChevronRight } from "lucide-react";
import { AgencyLayout } from "@/components/agency/AgencyLayout";
import { StudentsTable } from "@/components/agency/StudentsTable";
import { AddStudentModal } from "@/components/agency/AddStudentModal";
import { ReadinessBar } from "@/components/agency/ReadinessBar";
import {
  agencyGetStudents,
  agencyGetTeam,
  agencyAssignStudents,
  getAgencyAuth,
  type AgencyStudent,
  type AgencyTeamMember,
} from "@/lib/agency-api";

const SORT_OPTIONS = [
  { value: "name", label: "По имени" },
  { value: "readiness", label: "По готовности" },
  { value: "interview_date", label: "По дате интервью" },
];

type FilterTab = "all" | "unassigned" | string;

function formatLastActive(iso: string | null) {
  if (!iso) return "Никогда";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Вчера";
  if (diff < 7) return `${diff} дн. назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function AgencyStudentsPage() {
  const [students, setStudents] = useState<AgencyStudent[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [role, setRole] = useState<"admin" | "manager">("admin");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [managers, setManagers] = useState<AgencyTeamMember[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignBusy, setAssignBusy] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);

  const load = useCallback(async (q: string, s: string, tab: FilterTab) => {
    setLoading(true);
    try {
      const managerFilter = tab === "all" ? "" : tab;
      const res = await agencyGetStudents(q, s, managerFilter);
      setStudents(res.students);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const auth = getAgencyAuth();
    const r = auth?.role ?? "admin";
    setRole(r);

    if (r === "admin") {
      agencyGetTeam()
        .then((data) => setManagers(data.members.filter((m) => m.role === "manager" && m.status === "active")))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(search, sort, activeTab), 200);
    return () => clearTimeout(timer);
  }, [search, sort, activeTab, load]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAssign = async (managerId: string) => {
    if (!selectedIds.size) return;
    setAssignBusy(true);
    try {
      await agencyAssignStudents(Array.from(selectedIds), managerId);
      setSelectedIds(new Set());
      setShowAssignDropdown(false);
      load(search, sort, activeTab);
    } catch {
      alert("Ошибка назначения");
    } finally {
      setAssignBusy(false);
    }
  };

  return (
    <AgencyLayout>
      {showModal && (
        <AddStudentModal
          onClose={() => setShowModal(false)}
          onAdded={() => { setShowModal(false); load(search, sort, activeTab); }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {role === "manager" ? "Мои студенты" : "Студенты"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Всего: {total}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition"
        >
          <Plus size={16} />
          Добавить студента
        </button>
      </div>

      {/* Admin filter tabs */}
      {role === "admin" && (
        <div className="flex gap-1 mb-4 flex-wrap">
          {[
            { value: "all", label: "Все студенты" },
            { value: "unassigned", label: "Без менеджера" },
            ...managers.map((m) => ({ value: m.id, label: m.name })),
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setActiveTab(value as FilterTab); setSelectedIds(new Set()); }}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === value
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Bulk actions */}
      {role === "admin" && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <span className="text-sm text-blue-700 font-medium">Выбрано: {selectedIds.size}</span>
          <div className="relative">
            <button
              onClick={() => setShowAssignDropdown((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              Назначить менеджеру ▾
            </button>
            {showAssignDropdown && (
              <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-56 py-1">
                {managers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleAssign(m.id)}
                    disabled={assignBusy}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition flex items-center justify-between"
                  >
                    <span className="font-medium text-gray-900">{m.name}</span>
                    <span className="text-gray-400 text-xs">{m.students_count}</span>
                  </button>
                ))}
                <div className="border-t border-gray-100 mt-1">
                  <button
                    onClick={() => handleAssign("unassign")}
                    disabled={assignBusy}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-500 hover:bg-gray-50 transition"
                  >
                    Снять назначение
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => { setSelectedIds(new Set()); setShowAssignDropdown(false); }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Отмена
          </button>
        </div>
      )}

      {/* Search + sort */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени или email..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : role === "admin" ? (
        <AdminStudentsTable
          students={students}
          selectedIds={selectedIds}
          onToggle={toggleSelect}
          onToggleAll={() => {
            if (selectedIds.size === students.length) setSelectedIds(new Set());
            else setSelectedIds(new Set(students.map((s) => s.id)));
          }}
        />
      ) : (
        <StudentsTable students={students} />
      )}
    </AgencyLayout>
  );
}

// ─── Admin table with manager column + checkboxes ─────────────────────────────

function AdminStudentsTable({
  students,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  students: AgencyStudent[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}) {
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
      <div className="hidden md:grid grid-cols-[32px_2fr_1.5fr_1fr_1fr_1fr_1.5fr_auto] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        <label>
          <input
            type="checkbox"
            checked={selectedIds.size === students.length && students.length > 0}
            onChange={onToggleAll}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </label>
        <span>Студент</span>
        <span>Готовность</span>
        <span>Документы</span>
        <span>Симулятор</span>
        <span>Интервью</span>
        <span>Менеджер</span>
        <span />
      </div>

      <div className="divide-y divide-gray-50">
        {students.map((s) => (
          <div
            key={s.id}
            className={`grid grid-cols-1 md:grid-cols-[32px_2fr_1.5fr_1fr_1fr_1fr_1.5fr_auto] gap-4 px-5 py-4 items-center transition-colors hover:bg-gray-50 ${
              selectedIds.has(s.id) ? "bg-blue-50" : ""
            }`}
          >
            <label onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={selectedIds.has(s.id)}
                onChange={() => onToggle(s.id)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </label>
            <Link href={`/agency/students/${s.id}`} className="min-w-0 group">
              <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600">{s.name}</p>
              <p className="text-xs text-gray-400 truncate">{s.email}</p>
            </Link>
            <ReadinessBar value={s.readiness} />
            <span className={`text-sm font-semibold ${s.documents_pct >= 100 ? "text-emerald-600" : s.documents_pct >= 50 ? "text-amber-600" : "text-red-500"}`}>
              {s.documents_pct}%
            </span>
            <div className="text-sm text-gray-700">
              {s.simulator_sessions} сессий
              {s.simulator_avg_score > 0 && (
                <span className="block text-xs text-gray-400">{s.simulator_avg_score.toFixed(1)}/10</span>
              )}
            </div>
            <div>
              {s.days_until_interview === null ? (
                <span className="text-gray-400 text-xs">—</span>
              ) : s.days_until_interview <= 0 ? (
                <span className="text-xs text-gray-400">Прошло</span>
              ) : s.days_until_interview <= 3 ? (
                <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{s.days_until_interview}д!</span>
              ) : (
                <span className="text-xs text-gray-600">{s.days_until_interview}д</span>
              )}
            </div>
            <div>
              {s.assigned_manager_name ? (
                <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-full">
                  👤 {s.assigned_manager_name}
                </span>
              ) : (
                <span className="text-xs text-red-500 font-medium">Не назначен</span>
              )}
            </div>
            <Link href={`/agency/students/${s.id}`}>
              <ChevronRight size={16} className="text-gray-300 hover:text-gray-600 transition" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
