"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AgencyRootPage() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem("agency_token");
    router.replace(token ? "/agency/dashboard" : "/agency/login");
  }, [router]);
  return null;
}
