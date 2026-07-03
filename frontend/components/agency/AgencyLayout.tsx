"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AgencyNavbar } from "./AgencyNavbar";

interface Props {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function AgencyLayout({ children, requireAdmin = false }: Props) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [agencyName, setAgencyName] = useState<string>();
  const [memberName, setMemberName] = useState<string>();
  const [role, setRole] = useState<"admin" | "manager">("admin");

  useEffect(() => {
    const token = localStorage.getItem("agency_token");
    if (!token) {
      router.replace("/agency/login");
      return;
    }
    const r = (localStorage.getItem("agency_role") ?? "admin") as "admin" | "manager";
    if (requireAdmin && r !== "admin") {
      router.replace("/agency/dashboard");
      return;
    }
    setAgencyName(localStorage.getItem("agency_name") ?? undefined);
    setMemberName(localStorage.getItem("agency_member_name") ?? undefined);
    setRole(r);
    setReady(true);
  }, [router, requireAdmin]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-9 h-9 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AgencyNavbar agencyName={agencyName} role={role} memberName={memberName} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
