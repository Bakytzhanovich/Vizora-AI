"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  approveAdminPaymentRequest,
  cancelAdminPaymentRequest,
  getAdminPaymentRequests,
  type AdminPaymentRequest,
} from "@/lib/admin-api";

type Filter = "pending" | "approved" | "cancelled" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "pending", label: "Ожидают" },
  { id: "approved", label: "Оплачены" },
  { id: "cancelled", label: "Отменены" },
  { id: "all", label: "Все" },
];

const PLAN_LABELS: Record<string, string> = { standard: "Стандарт", premium: "Премиум" };
const STATUS_LABELS: Record<AdminPaymentRequest["status"], string> = {
  pending: "Ожидает",
  approved: "Доступ выдан",
  cancelled: "Отменена",
};

function formatPhone(p: string): string {
  return `+7 ${p.slice(1, 4)} ${p.slice(4, 7)} ${p.slice(7, 9)} ${p.slice(9, 11)}`;
}

function formatDate(iso: string): string {
  return new Date(iso + (iso.endsWith("Z") ? "" : "Z")).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PaymentRequestsContent() {
  const [filter, setFilter] = useState<Filter>("pending");
  const [requests, setRequests] = useState<AdminPaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRequests((await getAdminPaymentRequests(filter)).requests);
    } catch {
      setError("Не удалось загрузить заявки");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, action: "approve" | "cancel") => {
    setBusyId(id);
    setError(null);
    try {
      if (action === "approve") await approveAdminPaymentRequest(id);
      else await cancelAdminPaymentRequest(id);
      await load();
    } catch {
      setError(action === "approve" ? "Не удалось выдать доступ" : "Не удалось отменить заявку");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#242837] bg-[#12141C] p-4 text-sm leading-relaxed text-[#A3A8B8]">
        Студент оставил номер Kaspi → выстави ему счёт в Kaspi Pay для бизнеса на указанную сумму → когда счёт
        оплачен, нажми <span className="font-semibold text-[#F5F7FF]">«Дать доступ»</span>. Тариф включится сразу, а
        оставшиеся оплаченные дни у продлевающих не сгорят.
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр заявок">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition-colors ${
              filter === f.id ? "bg-blue-600 text-white" : "bg-[#12141C] border border-[#242837] text-[#A3A8B8] hover:text-[#F5F7FF]"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={load}
          className="min-h-11 rounded-lg px-4 text-sm font-semibold border border-[#242837] text-[#A3A8B8] hover:text-[#F5F7FF] ml-auto"
        >
          Обновить
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-[#81889B]">Загрузка…</p>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-[#242837] bg-[#12141C] p-8 text-center text-sm text-[#81889B]">
          {filter === "pending" ? "Новых заявок нет" : "Заявок нет"}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-[#242837] bg-[#12141C] p-4">
              <div className="min-w-[180px] flex-1">
                <p className="font-semibold text-[#F5F7FF]">{r.name || "Без имени"}</p>
                <p className="text-xs text-[#81889B]">{r.email}</p>
              </div>
              <div className="min-w-[150px]">
                <p className="font-semibold text-[#F5F7FF]">
                  {PLAN_LABELS[r.plan] ?? r.plan} · {r.billing_period === "yearly" ? "год" : "месяц"}
                </p>
                <p className="text-sm text-[#A3A8B8]">{new Intl.NumberFormat("ru-RU").format(r.amount)} ₸</p>
              </div>
              <div className="min-w-[160px]">
                <a href={`tel:+${r.phone}`} className="font-mono text-[#F5F7FF] hover:text-blue-300">
                  {formatPhone(r.phone)}
                </a>
                <p className="text-xs text-[#81889B]">{formatDate(r.created_at)}</p>
              </div>
              {r.status === "pending" ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => act(r.id, "approve")}
                    disabled={busyId === r.id}
                    className="min-h-11 rounded-lg bg-green-600 px-5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                  >
                    {busyId === r.id ? "…" : "Дать доступ"}
                  </button>
                  <button
                    onClick={() => act(r.id, "cancel")}
                    disabled={busyId === r.id}
                    className="min-h-11 rounded-lg border border-[#242837] px-4 text-sm font-semibold text-[#A3A8B8] hover:text-[#F5F7FF] disabled:opacity-50"
                  >
                    Отменить
                  </button>
                </div>
              ) : (
                <span className={`text-sm font-semibold ${r.status === "approved" ? "text-green-400" : "text-[#81889B]"}`}>
                  {STATUS_LABELS[r.status]}
                  {r.resolved_at ? ` · ${formatDate(r.resolved_at)}` : ""}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PaymentRequestsAdmin() {
  return (
    <AdminShell title="Оплаты" subtitle="Заявки на оплату через счёт Kaspi." active="Payments">
      <PaymentRequestsContent />
    </AdminShell>
  );
}
