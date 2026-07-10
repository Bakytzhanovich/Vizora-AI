"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Database,
  RefreshCw,
  ServerCog,
  Users,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  getAdminAgencies,
  getAdminAnalytics,
  getAdminManagers,
  getAdminOverview,
  getAdminSystem,
  getAdminUsers,
  type AdminAgenciesResponse,
  type AdminAnalytics,
  type AdminManagersResponse,
  type AdminOverview,
  type AdminSystem,
  type AdminUsersResponse,
} from "@/lib/admin-api";

type Section = "overview" | "users" | "agencies" | "managers" | "analytics" | "system";

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "agencies", label: "Agencies" },
  { id: "managers", label: "Team" },
  { id: "analytics", label: "Analytics" },
  { id: "system", label: "System" },
];

function fmtDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function number(value: number | undefined) {
  return new Intl.NumberFormat("ru-RU").format(value ?? 0);
}

function statusClass(status: string) {
  if (status === "active" || status === "completed") return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  if (status === "invited" || status === "running") return "bg-amber-500/10 text-amber-300 border-amber-500/20";
  if (status === "failed" || status === "deactivated") return "bg-red-500/10 text-red-300 border-red-500/20";
  return "bg-slate-500/10 text-slate-300 border-slate-500/20";
}

function SectionTabs({ section, setSection }: { section: Section; setSection: (section: Section) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {SECTIONS.map((item) => (
        <button
          key={item.id}
          onClick={() => setSection(item.id)}
          className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
            section === item.id
              ? "bg-blue-600 text-white"
              : "bg-[#12141C] text-[#A3A8B8] border border-[#242837] hover:text-white"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "blue",
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: typeof Users;
  tone?: "blue" | "emerald" | "amber" | "rose" | "slate";
}) {
  const tones = {
    blue: "border-blue-500/20 bg-blue-500/10 text-blue-300",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    rose: "border-rose-500/20 bg-rose-500/10 text-rose-300",
    slate: "border-slate-500/20 bg-slate-500/10 text-slate-300",
  };

  return (
    <div className="rounded-xl border border-[#242837] bg-[#12141C] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#81889B]">{title}</p>
          <p className="mt-2 text-2xl font-bold text-white">{number(value)}</p>
          {subtitle && <p className="mt-1 text-xs text-[#81889B]">{subtitle}</p>}
        </div>
        <div className={`rounded-lg border p-2 ${tones[tone]}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#242837] bg-[#12141C]">
      <div className="border-b border-[#242837] px-4 py-3">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-[#81889B]">{text}</p>;
}

function OverviewSection({ overview }: { overview: AdminOverview }) {
  const m = overview.metrics;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Пользователи" value={m.total_users} subtitle={`+${m.new_users_7d} за 7 дней`} icon={Users} />
        <StatCard title="Агентства" value={m.total_agencies} subtitle={`+${m.new_agencies_30d} за 30 дней`} icon={Building2} tone="emerald" />
        <StatCard title="Менеджеры" value={m.active_managers} subtitle={`${m.pending_invites} приглашений ждут`} icon={CheckCircle2} tone="amber" />
        <StatCard title="Студенты агентств" value={m.agency_students} subtitle={`${m.unassigned_students} без менеджера`} icon={Activity} tone="rose" />
        <StatCard title="AI вопросы" value={m.chat_questions} icon={BarChart3} tone="slate" />
        <StatCard title="Симулятор" value={m.simulator_sessions} subtitle={`${m.completed_simulations} завершено`} icon={Clock} />
        <StatCard title="Knowledge Base" value={m.knowledge_base_entries} subtitle={`${m.verified_knowledge_base_entries} verified`} icon={Database} tone="emerald" />
        <StatCard title="Early access" value={m.early_access_leads} icon={Users} tone="amber" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Новые пользователи">
          <div className="space-y-3">
            {overview.recent_users.map((user) => (
              <div key={`${user.email}-${user.created_at}`} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{user.name || user.email}</p>
                  <p className="truncate text-xs text-[#81889B]">{user.email}</p>
                </div>
                <span className="shrink-0 text-xs text-[#81889B]">{fmtDate(user.created_at)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Новые агентства">
          <div className="space-y-3">
            {overview.recent_agencies.map((agency) => (
              <div key={`${agency.email}-${agency.created_at}`} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{agency.name}</p>
                  <p className="truncate text-xs text-[#81889B]">{agency.email}</p>
                </div>
                <span className="shrink-0 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-xs text-blue-300">
                  {agency.plan}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Подписки">
          <div className="space-y-3">
            {overview.subscription_plans.length === 0 && <EmptyState text="Планов пока нет" />}
            {overview.subscription_plans.map((plan) => (
              <div key={plan.plan} className="flex items-center justify-between rounded-lg bg-[#0D0F16] px-3 py-2">
                <span className="text-sm text-[#DCE1EF]">{plan.plan}</span>
                <span className="text-sm font-semibold text-white">{plan.count}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function UsersSection({ data }: { data: AdminUsersResponse }) {
  return (
    <Panel title={`Пользователи (${data.total})`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs uppercase text-[#81889B]">
            <tr>
              <th className="pb-3 font-medium">Пользователь</th>
              <th className="pb-3 font-medium">Роль</th>
              <th className="pb-3 font-medium">Университет</th>
              <th className="pb-3 font-medium">Агентство</th>
              <th className="pb-3 font-medium">Менеджер</th>
              <th className="pb-3 font-medium">Создан</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#242837]">
            {data.users.map((user) => (
              <tr key={user.id}>
                <td className="py-3">
                  <p className="font-medium text-white">{user.name || "Без профиля"}</p>
                  <p className="text-xs text-[#81889B]">{user.email}</p>
                </td>
                <td className="py-3 text-[#DCE1EF]">{user.role}</td>
                <td className="py-3 text-[#DCE1EF]">{user.university || "-"}</td>
                <td className="py-3 text-[#DCE1EF]">{user.agency_name || "-"}</td>
                <td className="py-3 text-[#DCE1EF]">{user.manager_name || "-"}</td>
                <td className="py-3 text-[#81889B]">{fmtDate(user.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function AgenciesSection({ data }: { data: AdminAgenciesResponse }) {
  return (
    <Panel title={`Агентства (${data.total})`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="text-xs uppercase text-[#81889B]">
            <tr>
              <th className="pb-3 font-medium">Агентство</th>
              <th className="pb-3 font-medium">План</th>
              <th className="pb-3 font-medium">Страна</th>
              <th className="pb-3 font-medium">Студенты</th>
              <th className="pb-3 font-medium">Менеджеры</th>
              <th className="pb-3 font-medium">White-label</th>
              <th className="pb-3 font-medium">Создано</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#242837]">
            {data.agencies.map((agency) => (
              <tr key={agency.id}>
                <td className="py-3">
                  <p className="font-medium text-white">{agency.name}</p>
                  <p className="text-xs text-[#81889B]">{agency.email}</p>
                </td>
                <td className="py-3 text-[#DCE1EF]">{agency.subscription_plan}</td>
                <td className="py-3 text-[#DCE1EF]">{agency.country}</td>
                <td className="py-3 text-[#DCE1EF]">
                  {agency.students_count}
                  {agency.unassigned_count > 0 && (
                    <span className="ml-2 text-xs text-amber-300">{agency.unassigned_count} без менеджера</span>
                  )}
                </td>
                <td className="py-3 text-[#DCE1EF]">{agency.managers_count}</td>
                <td className="py-3 text-[#DCE1EF]">{agency.white_label_enabled ? "on" : "off"}</td>
                <td className="py-3 text-[#81889B]">{fmtDate(agency.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ManagersSection({ data }: { data: AdminManagersResponse }) {
  return (
    <Panel title={`Команды агентств (${data.total})`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs uppercase text-[#81889B]">
            <tr>
              <th className="pb-3 font-medium">Участник</th>
              <th className="pb-3 font-medium">Агентство</th>
              <th className="pb-3 font-medium">Роль</th>
              <th className="pb-3 font-medium">Статус</th>
              <th className="pb-3 font-medium">Студенты</th>
              <th className="pb-3 font-medium">Последний вход</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#242837]">
            {data.members.map((member) => (
              <tr key={member.id}>
                <td className="py-3">
                  <p className="font-medium text-white">{member.name}</p>
                  <p className="text-xs text-[#81889B]">{member.email}</p>
                </td>
                <td className="py-3 text-[#DCE1EF]">{member.agency_name}</td>
                <td className="py-3 text-[#DCE1EF]">{member.role}</td>
                <td className="py-3">
                  <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(member.status)}`}>
                    {member.status}
                  </span>
                </td>
                <td className="py-3 text-[#DCE1EF]">{member.students_count}</td>
                <td className="py-3 text-[#81889B]">{fmtDate(member.last_login)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function AnalyticsSection({ data }: { data: AdminAnalytics }) {
  const maxActivity = useMemo(() => {
    return Math.max(
      1,
      ...data.activity_14d.map((item) => item.registrations + item.chat_questions + item.simulator_sessions)
    );
  }, [data.activity_14d]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Воронка">
          <div className="space-y-3">
            {Object.entries(data.funnel).map(([key, value]) => (
              <div key={key}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-[#A3A8B8]">{key}</span>
                  <span className="font-semibold text-white">{number(value)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#0D0F16]">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${Math.min(100, (value / Math.max(1, data.funnel.registered_users)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Использование продукта">
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(data.product_usage).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-[#0D0F16] p-3">
                <p className="text-xs text-[#81889B]">{key}</p>
                <p className="mt-1 text-lg font-bold text-white">{number(value)}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Активность за 14 дней">
        <div className="flex h-56 items-end gap-2 overflow-x-auto">
          {data.activity_14d.map((item) => {
            const total = item.registrations + item.chat_questions + item.simulator_sessions;
            return (
              <div key={item.date} className="flex min-w-[54px] flex-1 flex-col items-center justify-end gap-2">
                <div className="flex h-40 w-full items-end rounded-lg bg-[#0D0F16] px-2 py-2">
                  <div
                    className="w-full rounded-md bg-gradient-to-t from-blue-600 to-emerald-400"
                    style={{ height: `${Math.max(4, (total / maxActivity) * 100)}%` }}
                    title={`${total} actions`}
                  />
                </div>
                <span className="text-[10px] text-[#81889B]">
                  {new Date(item.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Top events">
        {data.top_events.length === 0 ? (
          <EmptyState text="События пока не записывались" />
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {data.top_events.map((event) => (
              <div key={event.event} className="flex items-center justify-between rounded-lg bg-[#0D0F16] px-3 py-2">
                <span className="text-sm text-[#DCE1EF]">{event.event}</span>
                <span className="text-sm font-semibold text-white">{event.count}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function SystemSection({ data }: { data: AdminSystem }) {
  const flags = [
    ["ADMIN_SECRET", data.admin_secret_configured],
    ["OpenAI", data.openai_configured],
    ["Gemini", data.gemini_configured],
    ["Groq", data.groq_configured],
    ["Telegram", data.telegram_configured],
    ["Notification secret", data.notification_secret_configured],
    ["Scheduler", data.scheduler_running],
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard title="Knowledge Base" value={data.knowledge_base_entries} icon={Database} tone="emerald" />
        <StatCard title="Allowed origins" value={data.allowed_origins.length} icon={ServerCog} tone="slate" />
        <StatCard
          title="AI providers"
          value={[data.openai_configured, data.gemini_configured, data.groq_configured].filter(Boolean).length}
          subtitle={`${data.ai_provider} / ${data.ai_model}`}
          icon={Activity}
          tone="blue"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Конфигурация">
          <div className="space-y-2">
            {flags.map(([label, ok]) => (
              <div key={String(label)} className="flex items-center justify-between rounded-lg bg-[#0D0F16] px-3 py-2">
                <span className="text-sm text-[#DCE1EF]">{label}</span>
                <span className={`rounded-full border px-2 py-1 text-xs ${ok ? statusClass("active") : statusClass("failed")}`}>
                  {ok ? "configured" : "missing"}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Сервис">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-[#81889B]">Database</span>
              <span className="text-[#DCE1EF]">{data.database_provider}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#81889B]">Frontend URL</span>
              <span className="text-[#DCE1EF]">{data.frontend_url}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#81889B]">Next scraper run</span>
              <span className="text-[#DCE1EF]">{fmtDate(data.next_scraper_run)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#81889B]">Server time</span>
              <span className="text-[#DCE1EF]">{new Date(data.server_time).toLocaleString("ru-RU")}</span>
            </div>
          </div>
        </Panel>
      </div>

      {data.last_scraper_run && (
        <Panel title="Последний scraper run">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <p className="text-xs text-[#81889B]">Status</p>
              <p className="mt-1 text-sm text-white">{data.last_scraper_run.status}</p>
            </div>
            <div>
              <p className="text-xs text-[#81889B]">Sources</p>
              <p className="mt-1 text-sm text-white">{data.last_scraper_run.sources_scraped}</p>
            </div>
            <div>
              <p className="text-xs text-[#81889B]">New entries</p>
              <p className="mt-1 text-sm text-white">{data.last_scraper_run.new_entries_added}</p>
            </div>
            <div>
              <p className="text-xs text-[#81889B]">Completed</p>
              <p className="mt-1 text-sm text-white">{fmtDate(data.last_scraper_run.completed_at)}</p>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

function DashboardContent({ section }: { section: Section }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUsersResponse | null>(null);
  const [agencies, setAgencies] = useState<AdminAgenciesResponse | null>(null);
  const [managers, setManagers] = useState<AdminManagersResponse | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [system, setSystem] = useState<AdminSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [overviewData, usersData, agenciesData, managersData, analyticsData, systemData] = await Promise.all([
        getAdminOverview(),
        getAdminUsers(),
        getAdminAgencies(),
        getAdminManagers(),
        getAdminAnalytics(),
        getAdminSystem(),
      ]);
      setOverview(overviewData);
      setUsers(usersData);
      setAgencies(agenciesData);
      setManagers(managersData);
      setAnalytics(analyticsData);
      setSystem(systemData);
    } catch {
      setError("Не удалось загрузить admin данные");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-blue-500/30 border-t-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-200">
        <div className="flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={load}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#242837] bg-[#12141C] px-3 py-2 text-sm text-[#DCE1EF] hover:text-white"
        >
          <RefreshCw size={15} />
          Обновить
        </button>
      </div>

      {section === "overview" && overview && <OverviewSection overview={overview} />}
      {section === "users" && users && <UsersSection data={users} />}
      {section === "agencies" && agencies && <AgenciesSection data={agencies} />}
      {section === "managers" && managers && <ManagersSection data={managers} />}
      {section === "analytics" && analytics && <AnalyticsSection data={analytics} />}
      {section === "system" && system && <SystemSection data={system} />}
    </div>
  );
}

function DashboardRoute() {
  const searchParams = useSearchParams();
  const [section, setSection] = useState<Section>("overview");

  useEffect(() => {
    const requested = searchParams.get("section") as Section | null;
    if (requested && SECTIONS.some((item) => item.id === requested)) {
      setSection(requested);
    } else {
      setSection("overview");
    }
  }, [searchParams]);

  const active = section === "overview"
    ? "Overview"
    : section === "managers"
      ? "Team"
      : section;

  return (
    <AdminShell
      title="Vizora Admin Panel"
      subtitle="Owner dashboard: пользователи, агентства, команда, аналитика и системное состояние."
      active={active}
    >
      <>
        <div className="mb-5">
          <SectionTabs section={section} setSection={setSection} />
        </div>
        <DashboardContent section={section} />
      </>
    </AdminShell>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090A0F]" />}>
      <DashboardRoute />
    </Suspense>
  );
}
