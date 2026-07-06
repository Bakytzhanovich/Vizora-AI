"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, RotateCcw, Trash2, ChevronRight, Clock, X } from "lucide-react";
import { AgencyLayout } from "@/components/agency/AgencyLayout";
import {
  agencyGetTeam,
  agencyInviteMember,
  agencyDeactivateMember,
  agencyResendInvite,
  agencyUpdateMember,
  type AgencyTeamMember,
} from "@/lib/agency-api";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Вчера";
  if (diff < 7) return `${diff} дн. назад`;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function RoleBadge({ role }: { role: string }) {
  if (role === "admin")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        👑 Админ
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
      👤 Менеджер
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active")
    return <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">🟢 Активен</span>;
  if (status === "invited")
    return <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">🟡 Ожидает</span>;
  return <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">🔴 Деактивирован</span>;
}

interface InviteResult {
  invite_link: string;
  email: string;
}

interface ResendResult {
  invite_link: string;
  name: string;
}

export default function AgencyTeamPage() {
  const [members, setMembers] = useState<AgencyTeamMember[]>([]);
  const [stats, setStats] = useState({ total_members: 0, total_students: 0, pending_invites: 0 });
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<AgencyTeamMember | null>(null);
  const [resendResult, setResendResult] = useState<ResendResult | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await agencyGetTeam();
      setMembers(data.members);
      setStats({ total_members: data.total_members, total_students: data.total_students, pending_invites: data.pending_invites });
    } catch {
      /* interceptor handles 401 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDeactivate = async (member: AgencyTeamMember) => {
    setActionBusy(member.id);
    try {
      await agencyDeactivateMember(member.id);
      setDeactivateTarget(null);
      await load();
    } catch (e: unknown) {
      alert((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Ошибка");
    } finally {
      setActionBusy(null);
    }
  };

  const handleResendInvite = async (member: AgencyTeamMember) => {
    setActionBusy(member.id);
    try {
      const res = await agencyResendInvite(member.id);
      setResendResult({ invite_link: res.invite_link, name: member.name });
    } catch (e: unknown) {
      alert((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Ошибка");
    } finally {
      setActionBusy(null);
    }
  };

  const handleCancelInvite = async (member: AgencyTeamMember) => {
    if (!confirm(`Отменить приглашение для ${member.name}?`)) return;
    setActionBusy(member.id);
    try {
      await agencyDeactivateMember(member.id);
      await load();
    } catch (e: unknown) {
      alert((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Ошибка");
    } finally {
      setActionBusy(null);
    }
  };

  const handleReactivate = async (member: AgencyTeamMember) => {
    setActionBusy(member.id);
    try {
      await agencyUpdateMember(member.id, { status: "active" });
      await load();
    } catch (e: unknown) {
      alert((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Ошибка");
    } finally {
      setActionBusy(null);
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

  return (
    <AgencyLayout requireAdmin>
      {/* Invite Modal */}
      {showInvite && (
        <InviteModal
          onClose={() => { setShowInvite(false); setInviteResult(null); }}
          onInvited={(link, email) => { setInviteResult({ invite_link: link, email }); load(); }}
          inviteResult={inviteResult}
        />
      )}

      {/* Resend Invite Result */}
      {resendResult && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Новая ссылка отправлена</h3>
              <button onClick={() => setResendResult(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 mb-4">
              ✅ Ссылка для <strong>{resendResult.name}</strong> обновлена. Старая ссылка больше не действительна.
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Новая ссылка (действительна 7 дней):</p>
              <ResendLinkBox link={resendResult.invite_link} />
            </div>
            <button
              onClick={() => setResendResult(null)}
              className="mt-4 w-full py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Deactivate Confirm */}
      {deactivateTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-900 mb-2">Деактивировать менеджера?</h3>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-medium text-gray-700">{deactivateTarget.name}</span> потеряет доступ к кабинету.
            </p>
            <p className="text-sm text-gray-500 mb-5">
              Их студенты перейдут в статус «Без менеджера».
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeactivateTarget(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Отмена
              </button>
              <button
                onClick={() => handleDeactivate(deactivateTarget)}
                disabled={actionBusy === deactivateTarget.id}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50"
              >
                Деактивировать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Команда агентства</h1>
          <p className="text-sm text-gray-500 mt-0.5">Управляй менеджерами и распределяй студентов</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition"
        >
          <Plus size={16} />
          Пригласить менеджера
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Участников", value: stats.total_members, icon: "👥" },
          { label: "Студентов всего", value: stats.total_students, icon: "🎓" },
          { label: "Ждут приглашения", value: stats.pending_invites, icon: "📧" },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-2xl mb-1">{icon}</p>
            <p className="text-2xl font-black text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Team Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1.5fr_1fr_120px] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <span>Участник</span>
          <span>Email</span>
          <span>Роль</span>
          <span>Студентов</span>
          <span>Последний вход</span>
          <span>Статус</span>
          <span>Действия</span>
        </div>

        <div className="divide-y divide-gray-50">
          {members.map((m) => (
            <div
              key={m.id}
              className={`grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_1fr_1.5fr_1fr_120px] gap-4 px-5 py-4 items-center transition-colors ${
                m.status === "deactivated" ? "opacity-50 bg-gray-50" : "hover:bg-gray-50"
              } ${m.status === "invited" ? "border-dashed" : ""}`}
            >
              {/* Name */}
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  m.role === "admin" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                }`}>
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold text-gray-900 truncate ${m.status === "deactivated" ? "line-through" : ""}`}>
                    {m.name}
                  </p>
                  {m.joined_at && (
                    <p className="text-xs text-gray-400">с {new Date(m.joined_at).toLocaleDateString("ru-RU", { month: "short", year: "numeric" })}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <p className={`text-sm text-gray-600 truncate ${m.status === "deactivated" ? "line-through text-gray-400" : ""}`}>
                {m.email}
              </p>

              {/* Role */}
              <div><RoleBadge role={m.role} /></div>

              {/* Students */}
              <p className="text-sm font-semibold text-gray-900">{m.students_count}</p>

              {/* Last login */}
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock size={12} />
                {formatDate(m.last_login)}
              </div>

              {/* Status */}
              <div><StatusBadge status={m.status} /></div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {m.role === "admin" && (
                  <span className="text-xs text-gray-300">—</span>
                )}
                {m.role !== "admin" && m.status === "active" && (
                  <>
                    <Link
                      href={`/agency/team/${m.id}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                      title="Просмотр"
                    >
                      <ChevronRight size={15} />
                    </Link>
                    <button
                      onClick={() => setDeactivateTarget(m)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Деактивировать"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
                {m.role !== "admin" && m.status === "invited" && (
                  <>
                    <button
                      onClick={() => handleResendInvite(m)}
                      disabled={actionBusy === m.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition disabled:opacity-50"
                      title="Повторить приглашение"
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button
                      onClick={() => handleCancelInvite(m)}
                      disabled={actionBusy === m.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                      title="Отменить приглашение"
                    >
                      <X size={14} />
                    </button>
                  </>
                )}
                {m.role !== "admin" && m.status === "deactivated" && (
                  <button
                    onClick={() => handleReactivate(m)}
                    disabled={actionBusy === m.id}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition disabled:opacity-50"
                    title="Восстановить"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {members.length === 0 && (
          <div className="text-center py-16 px-4">
            <p className="text-3xl mb-3">👥</p>
            <p className="text-gray-500 text-sm">Пока нет участников команды</p>
            <button
              onClick={() => setShowInvite(true)}
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              Пригласить первого менеджера
            </button>
          </div>
        )}
      </div>
    </AgencyLayout>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ResendLinkBox({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API denied or unavailable — don't show false success
    }
  };
  return (
    <div className="flex gap-2">
      <input
        type="text"
        readOnly
        value={link}
        className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-xs text-gray-600 bg-gray-50 select-all"
      />
      <button
        onClick={copy}
        className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition shrink-0"
      >
        {copied ? "✓" : "📋"}
      </button>
    </div>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({
  onClose,
  onInvited,
  inviteResult,
}: {
  onClose: () => void;
  onInvited: (link: string, email: string) => void;
  inviteResult: InviteResult | null;
}) {
  const [form, setForm] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await agencyInviteMember({ name: form.name.trim(), email: form.email.trim(), role: "manager" });
      onInvited(res.invite_link, form.email.trim());
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Ошибка отправки приглашения");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (inviteResult) {
      try {
        await navigator.clipboard.writeText(inviteResult.invite_link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard API denied or unavailable
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-gray-900 text-lg">Пригласить менеджера</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        {!inviteResult ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Имя менеджера</label>
              <input
                type="text"
                value={form.name}
                onChange={set("name")}
                placeholder="Данияр Мухамедов"
                required
                autoFocus
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white text-sm text-gray-900 placeholder-gray-400 caret-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="manager@agency.kz"
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white text-sm text-gray-900 placeholder-gray-400 caret-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Роль</label>
              <div className="px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 bg-gray-50">
                👤 Менеджер
              </div>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? "Создаём приглашение..." : "Отправить приглашение"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
              ✅ Приглашение создано для <strong>{inviteResult.email}</strong>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Ссылка для входа:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteResult.invite_link}
                  className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-xs text-gray-600 bg-gray-50 select-all"
                />
                <button
                  onClick={copyLink}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition shrink-0"
                >
                  {copied ? "✓" : "📋"}
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Менеджер получит доступ после регистрации по этой ссылке. Ссылка действительна 7 дней.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
