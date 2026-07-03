import Link from "next/link";
import { AlertTriangle, AlertCircle } from "lucide-react";
import type { AgencyAlert } from "@/lib/agency-api";

interface Props {
  alert: AgencyAlert;
}

export function AlertCard({ alert }: Props) {
  const isCritical = alert.type === "critical";
  return (
    <Link
      href={`/agency/students/${alert.student_id}`}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 hover:shadow-sm transition-shadow ${
        isCritical
          ? "bg-red-50 border-red-200"
          : "bg-amber-50 border-amber-200"
      }`}
    >
      <div className={`mt-0.5 shrink-0 ${isCritical ? "text-red-500" : "text-amber-500"}`}>
        {isCritical ? <AlertCircle size={16} /> : <AlertTriangle size={16} />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{alert.student_name}</p>
        <p className="text-xs text-gray-600 mt-0.5">{alert.message}</p>
      </div>
      <span
        className={`ml-auto shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
          isCritical ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
        }`}
      >
        {isCritical ? "Критично" : "Предупр."}
      </span>
    </Link>
  );
}
