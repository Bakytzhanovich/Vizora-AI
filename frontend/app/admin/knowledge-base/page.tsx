"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Secret is never embedded in the JS bundle. It lives only in sessionStorage
// (cleared when the browser tab closes) and is validated against the API before
// the page renders.
function storedSecret(): string {
  return typeof window !== "undefined"
    ? sessionStorage.getItem("adminSecret") ?? ""
    : "";
}

function adminHeaders(secret: string) {
  return {
    "Content-Type": "application/json",
    "X-Admin-Secret": secret,
  };
}

interface KbEntry {
  id: string;
  category: string;
  question: string;
  answer: string;
  trust_level: string;
  source_url: string | null;
  created_at: string;
  verified: boolean;
}

interface ScraperRun {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  sources_scraped: string;
  new_entries_added: string;
  error_message: string | null;
}

const TRUST_COLORS: Record<string, string> = {
  "официальный источник": "bg-green-900/40 text-green-300 border-green-700/40",
  "по данным агентств": "bg-blue-900/40 text-blue-300 border-blue-700/40",
  "по опыту студентов (не официальная информация)": "bg-yellow-900/40 text-yellow-300 border-yellow-700/40",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "text-green-400",
  running: "text-blue-400",
  failed: "text-red-400",
};

export default function KnowledgeBaseAdmin() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null); // null = checking
  const [authError, setAuthError] = useState("");
  const [secretInput, setSecretInput] = useState("");

  const [entries, setEntries] = useState<KbEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [runs, setRuns] = useState<ScraperRun[]>([]);
  const [scraperStatus, setScraperStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runLoading, setRunLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterTrust, setFilterTrust] = useState("");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const PAGE_SIZE = 30;

  // On mount: try the stored secret; show login form if absent or invalid.
  useEffect(() => {
    const stored = storedSecret();
    if (!stored) { setAuthed(false); return; }
    fetch(`${API}/api/admin/scraper/status`, { headers: adminHeaders(stored) })
      .then((r) => {
        if (r.ok) { setSecret(stored); setAuthed(true); }
        else { sessionStorage.removeItem("adminSecret"); setAuthed(false); }
      })
      .catch(() => setAuthed(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const r = await fetch(`${API}/api/admin/scraper/status`, {
      headers: adminHeaders(secretInput),
    });
    if (r.ok) {
      sessionStorage.setItem("adminSecret", secretInput);
      setSecret(secretInput);
      setAuthed(true);
    } else {
      setAuthError("Неверный секрет");
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (filterCategory) params.set("category", filterCategory);
      if (filterTrust) params.set("trust_level", filterTrust);

      const [kbRes, statusRes, logsRes] = await Promise.all([
        fetch(`${API}/api/admin/knowledge-base?${params}`, { headers: adminHeaders(secret) }),
        fetch(`${API}/api/admin/scraper/status`, { headers: adminHeaders(secret) }),
        fetch(`${API}/api/admin/scraper/logs?limit=5`, { headers: adminHeaders(secret) }),
      ]);

      if (kbRes.ok) {
        const d = await kbRes.json();
        setEntries(d.entries);
        setTotal(d.total);
        setStats(d.stats_by_trust ?? {});
      }
      if (statusRes.ok) setScraperStatus(await statusRes.json());
      if (logsRes.ok) setRuns((await logsRes.json()).runs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (authed) loadData(); }, [authed, page, filterCategory, filterTrust]);

  async function triggerScraper() {
    setRunLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/scraper/run-now`, {
        method: "POST",
        headers: adminHeaders(secret),
      });
      if (r.ok) {
        alert("Парсинг запущен в фоне. Обновите страницу через несколько минут.");
      } else {
        alert("Ошибка: " + r.status);
      }
    } finally {
      setRunLoading(false);
    }
  }

  async function verifyEntry(id: string) {
    await fetch(`${API}/api/admin/knowledge-base/${id}/verify`, {
      method: "PATCH",
      headers: adminHeaders(secret),
    });
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, verified: true } : e));
  }

  async function deleteEntry(id: string) {
    if (!confirm("Удалить эту запись?")) return;
    await fetch(`${API}/api/admin/knowledge-base/${id}`, {
      method: "DELETE",
      headers: adminHeaders(secret),
    });
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setTotal((t) => t - 1);
  }

  const totalEntries = scraperStatus?.knowledge_base_size ?? total;

  if (authed === null) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center font-mono text-[#8B8BA7]">
        Проверка...
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center font-mono">
        <form onSubmit={handleLogin} className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-8 w-full max-w-sm">
          <h1 className="text-lg font-bold text-[#F0F0FF] mb-6">Vizora AI — Admin</h1>
          <label className="block text-xs text-[#8B8BA7] mb-1">Admin secret</label>
          <input
            type="password"
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg px-3 py-2 text-sm text-[#F0F0FF] outline-none focus:border-[#6C63FF] mb-4"
            autoFocus
          />
          {authError && <p className="text-red-400 text-xs mb-3">{authError}</p>}
          <button
            type="submit"
            className="w-full bg-[#6C63FF] hover:bg-[#5a52e0] text-white py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            Войти
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F0F0FF] p-6 font-mono">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Vizora AI — Knowledge Base</h1>
            <p className="text-[#8B8BA7] text-sm mt-1">Внутренний инструмент. Всего записей: {totalEntries}</p>
          </div>
          <button
            onClick={triggerScraper}
            disabled={runLoading}
            className="bg-[#6C63FF] hover:bg-[#5a52e0] disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            {runLoading ? "Запускаем..." : "▶ Запустить парсинг сейчас"}
          </button>
        </div>

        {/* Stats by trust level */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { key: "официальный источник", label: "Официальные", color: "border-green-700/40" },
            { key: "по данным агентств", label: "Агентства", color: "border-blue-700/40" },
            { key: "по опыту студентов (не официальная информация)", label: "Студенты", color: "border-yellow-700/40" },
          ].map(({ key, label, color }) => (
            <div key={key} className={`bg-[#13131A] border ${color} rounded-xl p-4`}>
              <div className="text-2xl font-bold">{stats[key] ?? 0}</div>
              <div className="text-[#8B8BA7] text-xs mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Scraper status */}
        {scraperStatus && (
          <div className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-4 mb-6">
            <h2 className="text-sm font-bold text-[#8B8BA7] uppercase tracking-wide mb-3">Планировщик парсинга</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[#8B8BA7]">Следующий запуск: </span>
                <span>{scraperStatus.next_scheduled_run
                  ? new Date(scraperStatus.next_scheduled_run).toLocaleString("ru")
                  : "не запланирован"}</span>
              </div>
              {scraperStatus.last_run && (
                <>
                  <div>
                    <span className="text-[#8B8BA7]">Последний: </span>
                    <span className={STATUS_COLORS[scraperStatus.last_run.status] ?? "text-white"}>
                      {scraperStatus.last_run.status}
                    </span>
                    <span className="text-[#8B8BA7] ml-2">
                      ({scraperStatus.last_run.new_entries_added} новых)
                    </span>
                  </div>
                  {scraperStatus.last_run.error_message && (
                    <div className="col-span-2 text-red-400 text-xs">
                      Ошибка: {scraperStatus.last_run.error_message}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Recent runs */}
        {runs.length > 0 && (
          <div className="bg-[#13131A] border border-[#1E1E2E] rounded-xl p-4 mb-6">
            <h2 className="text-sm font-bold text-[#8B8BA7] uppercase tracking-wide mb-3">История запусков</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#8B8BA7] text-left">
                  <th className="pb-2">Дата</th>
                  <th className="pb-2">Статус</th>
                  <th className="pb-2">Источников</th>
                  <th className="pb-2">Новых</th>
                  <th className="pb-2">Ошибка</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-[#1E1E2E]">
                    <td className="py-1.5">{new Date(r.started_at).toLocaleString("ru")}</td>
                    <td className={`py-1.5 ${STATUS_COLORS[r.status] ?? ""}`}>{r.status}</td>
                    <td className="py-1.5">{r.sources_scraped}</td>
                    <td className="py-1.5">{r.new_entries_added}</td>
                    <td className="py-1.5 text-red-400 truncate max-w-[200px]">{r.error_message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <select
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setPage(0); }}
            className="bg-[#13131A] border border-[#1E1E2E] rounded-lg px-3 py-2 text-sm text-[#F0F0FF] outline-none"
          >
            <option value="">Все категории</option>
            {["visa_j1","documents","visa_interview","taxes","life_usa","program","program_basics","ssn"].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={filterTrust}
            onChange={(e) => { setFilterTrust(e.target.value); setPage(0); }}
            className="bg-[#13131A] border border-[#1E1E2E] rounded-lg px-3 py-2 text-sm text-[#F0F0FF] outline-none"
          >
            <option value="">Все источники</option>
            <option value="официальный источник">Официальные</option>
            <option value="по данным агентств">Агентства</option>
            <option value="по опыту студентов (не официальная информация)">Студенты</option>
          </select>
          <button onClick={loadData} className="border border-[#1E1E2E] rounded-lg px-3 py-2 text-sm text-[#8B8BA7] hover:text-white transition-colors">
            Обновить
          </button>
          <span className="ml-auto text-[#8B8BA7] text-sm self-center">
            {total} записей
          </span>
        </div>

        {/* Entries table */}
        {loading ? (
          <div className="text-center text-[#8B8BA7] py-20">Загрузка...</div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-[#13131A] border border-[#1E1E2E] rounded-xl overflow-hidden"
              >
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-[#1a1a24] transition-colors"
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-[#8B8BA7] bg-[#0A0A0F] px-2 py-0.5 rounded">
                        {entry.category}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded border ${TRUST_COLORS[entry.trust_level] ?? "text-gray-400"}`}>
                        {entry.trust_level === "по опыту студентов (не официальная информация)"
                          ? "студенты"
                          : entry.trust_level === "по данным агентств"
                          ? "агентства"
                          : "официальный"}
                      </span>
                      {entry.verified && (
                        <span className="text-xs text-green-400">✓ проверено</span>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{entry.question}</p>
                    {expandedId !== entry.id && (
                      <p className="text-xs text-[#8B8BA7] truncate mt-0.5">{entry.answer}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!entry.verified && (
                      <button
                        onClick={(e) => { e.stopPropagation(); verifyEntry(entry.id); }}
                        className="text-xs text-green-400 hover:text-green-300 border border-green-700/40 px-2 py-1 rounded transition-colors"
                      >
                        ✓
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteEntry(entry.id); }}
                      className="text-xs text-red-400 hover:text-red-300 border border-red-700/40 px-2 py-1 rounded transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {expandedId === entry.id && (
                  <div className="px-4 pb-4 border-t border-[#1E1E2E] pt-3">
                    <p className="text-sm text-[#F0F0FF] mb-2">{entry.answer}</p>
                    <div className="flex gap-4 text-xs text-[#8B8BA7]">
                      {entry.source_url && (
                        <a
                          href={entry.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#6C63FF] hover:underline truncate max-w-[400px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {entry.source_url}
                        </a>
                      )}
                      <span>{new Date(entry.created_at).toLocaleDateString("ru")}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex justify-center gap-3 mt-6">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="border border-[#1E1E2E] rounded-lg px-4 py-2 text-sm disabled:opacity-30 hover:border-[#6C63FF] transition-colors"
            >
              ← Пред
            </button>
            <span className="self-center text-sm text-[#8B8BA7]">
              {page + 1} / {Math.ceil(total / PAGE_SIZE)}
            </span>
            <button
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage((p) => p + 1)}
              className="border border-[#1E1E2E] rounded-lg px-4 py-2 text-sm disabled:opacity-30 hover:border-[#6C63FF] transition-colors"
            >
              След →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
