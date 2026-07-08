"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  Bot,
  Building2,
  Database,
  LayoutDashboard,
  LogOut,
  ServerCog,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  clearStoredAdminSecret,
  getStoredAdminSecret,
  setStoredAdminSecret,
  validateAdminSecret,
} from "@/lib/admin-api";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/dashboard?section=users", label: "Users", icon: Users },
  { href: "/admin/dashboard?section=agencies", label: "Agencies", icon: Building2 },
  { href: "/admin/dashboard?section=analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/knowledge-base", label: "Knowledge Base", icon: Database },
  { href: "/admin/dashboard?section=system", label: "System", icon: ServerCog },
];

interface AdminShellProps {
  title: string;
  subtitle?: string;
  active?: string;
  actions?: ReactNode;
  children: (secret: string) => ReactNode;
}

export function AdminShell({ title, subtitle, active, actions, children }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [secret, setSecret] = useState("");
  const [secretInput, setSecretInput] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const stored = getStoredAdminSecret();
    if (!stored) {
      setAuthed(false);
      return;
    }
    validateAdminSecret(stored)
      .then(() => {
        setSecret(stored);
        setAuthed(true);
      })
      .catch(() => {
        clearStoredAdminSecret();
        setAuthed(false);
      });
  }, []);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setAuthError("");
    try {
      await validateAdminSecret(secretInput);
      setStoredAdminSecret(secretInput);
      setSecret(secretInput);
      setAuthed(true);
    } catch {
      setAuthError("Неверный admin secret");
    }
  }

  function logout() {
    clearStoredAdminSecret();
    setSecret("");
    setAuthed(false);
    router.replace("/admin");
  }

  if (authed === null) {
    return (
      <div className="min-h-screen bg-[#090A0F] flex items-center justify-center text-[#A3A8B8]">
        Проверка доступа...
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#090A0F] flex items-center justify-center px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-[#12141C] border border-[#242837] rounded-xl p-7 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-7">
            <div className="w-10 h-10 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center">
              <ShieldCheck size={20} className="text-blue-300" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#F5F7FF]">Vizora Admin Panel</h1>
              <p className="text-xs text-[#81889B]">Owner access</p>
            </div>
          </div>
          <label className="block text-xs font-medium text-[#A3A8B8] mb-2">Admin secret</label>
          <input
            type="password"
            value={secretInput}
            onChange={(event) => setSecretInput(event.target.value)}
            className="w-full bg-[#090A0F] border border-[#2A3040] rounded-lg px-3 py-2.5 text-sm text-[#F5F7FF] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 mb-4"
            autoFocus
          />
          {authError && <p className="text-sm text-red-300 mb-3">{authError}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            Войти
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090A0F] text-[#F5F7FF]">
      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r border-[#202431] bg-[#0F1118] px-4 py-5 lg:block">
        <Link href="/admin/dashboard" className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center">
            <Bot size={18} className="text-blue-300" />
          </div>
          <div>
            <p className="text-sm font-bold">Vizora</p>
            <p className="text-xs text-[#81889B]">Admin Panel</p>
          </div>
        </Link>

        <nav className="mt-8 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active
              ? item.label.toLowerCase().includes(active.toLowerCase())
              : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-[#A3A8B8] hover:bg-[#171A24] hover:text-white"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={logout}
          className="absolute bottom-5 left-4 right-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#A3A8B8] hover:bg-[#171A24] hover:text-white transition"
        >
          <LogOut size={16} />
          Выйти
        </button>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-[#202431] bg-[#090A0F]/90 backdrop-blur px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">{title}</h1>
              {subtitle && <p className="text-sm text-[#81889B] mt-1">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-lg border border-[#242837] px-3 py-2 text-xs text-[#A3A8B8]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6">
          {children(secret)}
        </main>
      </div>
    </div>
  );
}
