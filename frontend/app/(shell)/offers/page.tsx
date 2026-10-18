"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Briefcase, ChevronDown, ChevronUp, Flag, MapPin, Plus, Search, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  apiGetMyOffers,
  apiGetOffers,
  apiMarkOfferSold,
  apiReportOffer,
  type JobOffer,
  type MyJobOffer,
} from "@/lib/api";

type Tab = "all" | "mine";

const formatPhone = (p: string) => `+7 ${p.slice(1, 4)} ${p.slice(4, 7)} ${p.slice(7, 9)} ${p.slice(9, 11)}`;
const formatKzt = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

function contactLink(contact: string): { href: string; kind: "tg" | "wa" } {
  return contact.startsWith("@")
    ? { href: `https://t.me/${contact.slice(1)}`, kind: "tg" }
    : { href: `https://wa.me/${contact}`, kind: "wa" };
}

function OfferFacts({ offer }: { offer: JobOffer }) {
  const { t } = useTranslation("offers");
  return (
    <>
      <p className="text-primary font-semibold leading-snug">{offer.position}</p>
      <p className="text-secondary text-sm">{offer.employer}</p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-secondary">
        <span className="inline-flex items-center gap-1">
          <MapPin size={12} aria-hidden />
          {offer.city}, {offer.state}
        </span>
        <span>{t("dates", { start: formatDate(offer.start_date), end: formatDate(offer.end_date) })}</span>
        <span>{t("per_hour", { wage: offer.hourly_wage, hours: offer.hours_per_week })}</span>
      </div>
    </>
  );
}

function OfferCard({ offer, isMine }: { offer: JobOffer; isMine: boolean }) {
  const { t } = useTranslation("offers");
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const link = contactLink(offer.contact);
  const warnings = t("warning", { returnObjects: true }) as string[];

  const report = async () => {
    try {
      await apiReportOffer(offer.id);
      setReported(true);
    } catch {
      // The listing may have just been hidden or sold; nothing useful to show.
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full text-left p-4 flex gap-3">
        <div className="min-w-0 flex-1">
          <OfferFacts offer={offer} />
        </div>
        <div className="shrink-0 text-right">
          <p className="text-accent font-bold">{formatKzt(offer.price_kzt)} ₸</p>
          {isMine && <p className="text-xs text-secondary mt-1">{t("mine_badge")}</p>}
          <span className="inline-flex mt-2 text-secondary">{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-secondary">{t("sponsor")}</dt>
            <dd className="text-primary">{offer.sponsor}</dd>
            {offer.agency && (
              <>
                <dt className="text-secondary">{t("agency")}</dt>
                <dd className="text-primary">{offer.agency}</dd>
              </>
            )}
            {offer.housing && (
              <>
                <dt className="text-secondary">{t("housing")}</dt>
                <dd className="text-primary">{offer.housing}</dd>
              </>
            )}
          </dl>
          {offer.description && <p className="text-sm text-primary whitespace-pre-line">{offer.description}</p>}

          <div className="rounded-xl bg-warning/10 border border-warning/30 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-warning mb-1.5">
              <ShieldAlert size={16} aria-hidden />
              {t("warning_title")}
            </p>
            <ul className="space-y-1 text-xs text-primary list-disc pl-4">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>

          {!isMine && (
            <div className="space-y-1">
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-11 inline-flex items-center justify-center rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors px-4"
              >
                {link.kind === "tg" ? t("contact_tg") : t("contact_wa")}
              </a>
              <button
                onClick={report}
                disabled={reported}
                className="min-h-11 inline-flex items-center gap-1.5 px-1 text-xs text-secondary hover:text-primary disabled:opacity-60"
              >
                <Flag size={14} aria-hidden />
                {reported ? t("reported") : t("report")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MyOfferCard({ offer, listingDays, onSold }: { offer: MyJobOffer; listingDays: number; onSold: () => void }) {
  const { t } = useTranslation("offers");
  const [busy, setBusy] = useState(false);
  const tone =
    offer.status === "published" ? "text-teal" : offer.status === "rejected" || offer.status === "hidden" ? "text-error" : "text-secondary";

  const markSold = async () => {
    setBusy(true);
    try {
      await apiMarkOfferSold(offer.id);
      onSold();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <OfferFacts offer={offer} />
        </div>
        <p className="shrink-0 text-accent font-bold">{formatKzt(offer.price_kzt)} ₸</p>
      </div>
      <p className={`text-sm font-semibold ${tone}`}>{t(`status.${offer.status}`)}</p>
      {offer.status === "pending" && (
        <p className="text-xs text-secondary">
          {t("pending_hint", { fee: formatKzt(offer.listing_fee), phone: formatPhone(offer.phone), days: listingDays })}
        </p>
      )}
      {offer.status === "rejected" && offer.reject_reason && (
        <p className="text-xs text-secondary">{t("reject_reason", { reason: offer.reject_reason })}</p>
      )}
      {(offer.status === "published" || offer.status === "hidden") && (
        <button
          onClick={markSold}
          disabled={busy}
          className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold text-primary hover:border-accent disabled:opacity-60"
        >
          {t("mark_sold")}
        </button>
      )}
    </div>
  );
}

export default function OffersPage() {
  const router = useRouter();
  const { t } = useTranslation("offers");
  const [tab, setTab] = useState<Tab>("all");
  const [offers, setOffers] = useState<(JobOffer & { is_mine: boolean })[]>([]);
  const [mine, setMine] = useState<MyJobOffer[]>([]);
  const [listingDays, setListingDays] = useState(30);
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [all, my] = await Promise.all([apiGetOffers({}), apiGetMyOffers()]);
      setOffers(all.offers);
      setListingDays(all.listing_days);
      setMine(my);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      router.replace("/login");
      return;
    }
    // The sell form sends the seller back here to see their pending listing.
    if (new URLSearchParams(window.location.search).get("tab") === "mine") setTab("mine");
    load();
  }, [router, load]);

  const states = useMemo(() => Array.from(new Set(offers.map((o) => o.state))).sort(), [offers]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return offers.filter(
      (o) =>
        (!state || o.state === state) &&
        (!q || [o.position, o.employer, o.city].some((f) => f.toLowerCase().includes(q)))
    );
  }, [offers, query, state]);

  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            aria-label={t("common.back", { ns: "common" })}
            className="-m-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-primary font-bold leading-tight">{t("title")}</h1>
            <p className="text-secondary text-xs">{t("subtitle")}</p>
          </div>
          <button
            onClick={() => router.push("/offers/new")}
            className="min-h-11 shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
          >
            <Plus size={16} aria-hidden />
            {t("sell_short")}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-24 lg:pb-6 space-y-4">
        <div className="flex gap-1 rounded-xl bg-card border border-border p-1" role="tablist">
          {(["all", "mine"] as Tab[]).map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex-1 min-h-10 rounded-lg text-sm font-semibold transition-colors ${
                tab === id ? "bg-accent text-white" : "text-secondary hover:text-primary"
              }`}
            >
              {id === "all" ? t("tab_all") : `${t("tab_mine")}${mine.length ? ` · ${mine.length}` : ""}`}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error flex items-center justify-between gap-3">
            {t("error")}
            <button onClick={load} className="min-h-11 px-3 font-semibold underline">
              ↻
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        ) : tab === "all" ? (
          <>
            <div className="flex gap-2">
              <label className="relative flex-1">
                <span className="sr-only">{t("search")}</span>
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" aria-hidden />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("search")}
                  className="w-full min-h-11 rounded-xl bg-card border border-border pl-9 pr-3 text-base text-primary placeholder:text-secondary focus:border-accent outline-none"
                />
              </label>
              {states.length > 1 && (
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  aria-label={t("all_states")}
                  className="min-h-11 rounded-xl bg-card border border-border px-3 text-base text-primary"
                >
                  <option value="">{t("all_states")}</option>
                  {states.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {visible.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-8 text-center">
                <Briefcase size={28} className="mx-auto mb-2 text-secondary" aria-hidden />
                <p className="text-sm text-secondary">{offers.length ? t("empty_filtered") : t("empty")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visible.map((o) => (
                  <OfferCard key={o.id} offer={o} isMine={o.is_mine} />
                ))}
              </div>
            )}
          </>
        ) : mine.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
            <p className="text-sm text-secondary">{t("mine_empty")}</p>
            <button
              onClick={() => router.push("/offers/new")}
              className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              {t("sell")}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {mine.map((o) => (
              <MyOfferCard key={o.id} offer={o} listingDays={listingDays} onSold={load} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
