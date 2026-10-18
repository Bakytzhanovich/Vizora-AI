"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  getAdminOffers,
  openAdminOfferProof,
  publishAdminOffer,
  rejectAdminOffer,
  type AdminJobOffer,
  type AdminOfferStatus,
} from "@/lib/admin-api";

type Filter = AdminOfferStatus | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "pending", label: "На проверке" },
  { id: "hidden", label: "Скрыты по жалобам" },
  { id: "published", label: "Опубликованы" },
  { id: "rejected", label: "Отклонены" },
  { id: "sold", label: "Проданы" },
  { id: "all", label: "Все" },
];

const STATUS_LABELS: Record<AdminOfferStatus, string> = {
  pending: "На проверке",
  published: "Опубликован",
  hidden: "Скрыт",
  rejected: "Отклонён",
  sold: "Продан",
};

const formatKzt = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

function formatPhone(p: string): string {
  return `+7 ${p.slice(1, 4)} ${p.slice(4, 7)} ${p.slice(7, 9)} ${p.slice(9, 11)}`;
}

function OffersContent() {
  const [filter, setFilter] = useState<Filter>("pending");
  const [offers, setOffers] = useState<AdminJobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOffers((await getAdminOffers(filter)).offers);
    } catch {
      setError("Не удалось загрузить офферы");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (id: string, action: () => Promise<void>, failText: string) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      setRejecting(null);
      await load();
    } catch {
      setError(failText);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#242837] bg-[#12141C] p-4 text-sm leading-relaxed text-[#A3A8B8]">
        Студент разместил оффер → открой файл и проверь, что оффер настоящий → выстави счёт Kaspi на сумму размещения
        на указанный номер → когда счёт оплачен, нажми <span className="font-semibold text-[#F5F7FF]">«Опубликовать»</span>.
        Объявление провисит 30 дней. После 3 жалоб оно скрывается и попадает сюда снова.
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр офферов">
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
      ) : offers.length === 0 ? (
        <div className="rounded-xl border border-[#242837] bg-[#12141C] p-8 text-center text-sm text-[#81889B]">
          Офферов нет
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((o) => (
            <div key={o.id} className="rounded-xl border border-[#242837] bg-[#12141C] p-4 space-y-3">
              <div className="flex flex-wrap gap-4">
                <div className="min-w-[200px] flex-1">
                  <p className="font-semibold text-[#F5F7FF]">
                    {o.position} · {o.employer}
                  </p>
                  <p className="text-sm text-[#A3A8B8]">
                    {o.city}, {o.state} · {o.start_date} — {o.end_date} · ${o.hourly_wage}/ч · {o.hours_per_week} ч/нед
                  </p>
                  <p className="text-sm text-[#A3A8B8]">
                    Спонсор: {o.sponsor}
                    {o.agency ? ` · Агентство: ${o.agency}` : ""}
                    {o.housing ? ` · Жильё: ${o.housing}` : ""}
                  </p>
                  {o.description && <p className="mt-1 text-sm text-[#A3A8B8] whitespace-pre-line">{o.description}</p>}
                </div>
                <div className="min-w-[180px] text-sm">
                  <p className="text-[#F5F7FF] font-semibold">{formatKzt(o.price_kzt)} ₸ за оффер</p>
                  <p className="text-[#A3A8B8]">{o.email}</p>
                  <p className="text-[#A3A8B8]">Контакт: {o.contact.startsWith("@") ? o.contact : formatPhone(o.contact)}</p>
                  <a href={`tel:+${o.phone}`} className="font-mono text-[#F5F7FF] hover:text-blue-300">
                    Kaspi: {formatPhone(o.phone)}
                  </a>
                  <p className="text-[#A3A8B8]">Счёт: {formatKzt(o.listing_fee)} ₸</p>
                  {o.reports_count > 0 && <p className="text-amber-400">Жалоб: {o.reports_count}</p>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => run(o.id, () => openAdminOfferProof(o.id), "Не удалось открыть файл")}
                  className="min-h-11 rounded-lg border border-[#242837] px-4 text-sm font-semibold text-[#F5F7FF] hover:border-blue-500"
                >
                  Открыть оффер ({o.proof_type === "application/pdf" ? "PDF" : "фото"})
                </button>
                {o.status === "pending" || o.status === "hidden" ? (
                  <>
                    <button
                      onClick={() => run(o.id, () => publishAdminOffer(o.id), "Не удалось опубликовать")}
                      disabled={busyId === o.id}
                      className="min-h-11 rounded-lg bg-green-600 px-5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                    >
                      {busyId === o.id ? "…" : "Опубликовать"}
                    </button>
                    <button
                      onClick={() => setRejecting({ id: o.id, reason: "" })}
                      disabled={busyId === o.id}
                      className="min-h-11 rounded-lg border border-[#242837] px-4 text-sm font-semibold text-[#A3A8B8] hover:text-[#F5F7FF] disabled:opacity-50"
                    >
                      Отклонить
                    </button>
                  </>
                ) : (
                  <span className={`text-sm font-semibold ${o.status === "published" ? "text-green-400" : "text-[#81889B]"}`}>
                    {STATUS_LABELS[o.status]}
                    {o.reject_reason ? ` · ${o.reject_reason}` : ""}
                  </span>
                )}
              </div>

              {rejecting?.id === o.id && (
                <div className="flex flex-wrap gap-2">
                  <input
                    autoFocus
                    value={rejecting.reason}
                    onChange={(e) => setRejecting({ id: o.id, reason: e.target.value })}
                    placeholder="Причина — её увидит студент"
                    maxLength={300}
                    className="min-h-11 flex-1 min-w-[220px] rounded-lg border border-[#242837] bg-[#0B0D13] px-3 text-sm text-[#F5F7FF]"
                  />
                  <button
                    onClick={() => run(o.id, () => rejectAdminOffer(o.id, rejecting.reason), "Не удалось отклонить")}
                    disabled={rejecting.reason.trim().length < 3 || busyId === o.id}
                    className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    Отклонить
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OffersAdmin() {
  return (
    <AdminShell title="Офферы" subtitle="Объявления о продаже офферов Work & Travel." active="Offers">
      <OffersContent />
    </AdminShell>
  );
}
