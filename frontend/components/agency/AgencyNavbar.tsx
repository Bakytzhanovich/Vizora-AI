"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, LayoutDashboard, Users, BarChart2, Settings, UsersRound } from "lucide-react";
import { agencyLogout } from "@/lib/agency-api";

const ADMIN_NAV = [
  { href: "/agency/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/agency/students", label: "Студенты", icon: Users },
  { href: "/agency/analytics", label: "Аналитика", icon: BarChart2 },
  { href: "/agency/team", label: "Команда", icon: UsersRound },
  { href: "/agency/settings", label: "Настройки", icon: Settings },
];

const MANAGER_NAV = [
  { href: "/agency/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/agency/students", label: "Мои студенты", icon: Users },
  { href: "/agency/analytics", label: "Аналитика", icon: BarChart2 },
];

interface Props {
  agencyName?: string;
  role?: "admin" | "manager";
  memberName?: string;
}

export function AgencyNavbar({ agencyName, role = "admin", memberName }: Props) {
  const path = usePathname();
  const nav = role === "admin" ? ADMIN_NAV : MANAGER_NAV;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/agency/dashboard" className="flex items-center gap-2 shrink-0">
          <span className="text-blue-600 font-black text-xl">◈</span>
          <span className="font-bold text-gray-900 text-sm sm:text-base">
            {agencyName || "Vizora"}{" "}
            <span className="text-blue-600 font-semibold text-xs bg-blue-50 px-1.5 py-0.5 rounded-full ml-1">
              {role === "admin" ? "Agency" : "Manager"}
            </span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = path === href || (href !== "/agency/dashboard" && path.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right: member name + logout */}
        <div className="flex items-center gap-3">
          {memberName && (
            <span className="hidden sm:block text-xs text-gray-400 max-w-[120px] truncate">
              {memberName}
            </span>
          )}
          <button
            onClick={agencyLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Выйти</span>
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="flex md:hidden border-t border-gray-100 bg-white">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== "/agency/dashboard" && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                active ? "text-blue-600" : "text-gray-500"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
