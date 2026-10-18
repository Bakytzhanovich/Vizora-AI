"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { ArrowLeft, CheckCircle2, Paperclip } from "lucide-react";
import { useTranslation } from "react-i18next";

import { apiCreateOffer, apiGetOffers } from "@/lib/api";

const MAX_PROOF_BYTES = 3 * 1024 * 1024;

const inputClass =
  "w-full min-h-11 rounded-xl bg-card border border-border px-3 text-base text-primary placeholder:text-secondary focus:border-accent outline-none";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-primary">{label}</span>
      {children}
      {hint && <span className="block text-xs text-secondary">{hint}</span>}
    </label>
  );
}

export default function NewOfferPage() {
  const router = useRouter();
  const { t } = useTranslation("offers");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ phone: string } | null>(null);
  // The fee lives on the backend (routers/offers.py); the board endpoint reports it.
  const [terms, setTerms] = useState<{ fee: number; days: number } | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      router.replace("/login");
      return;
    }
    apiGetOffers({})
      .then((d) => setTerms({ fee: d.listing_fee_kzt, days: d.listing_days }))
      .catch(() => {});
  }, [router]);

  const fee = terms ? new Intl.NumberFormat("ru-RU").format(terms.fee) : "…";

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!file || file.size > MAX_PROOF_BYTES) {
      setError(t("form.errors.file"));
      return;
    }
    if (String(form.get("end_date")) <= String(form.get("start_date"))) {
      setError(t("form.errors.dates"));
      return;
    }
    form.set("proof", file);
    setSending(true);
    setError(null);
    try {
      const res = await apiCreateOffer(form);
      setDone({ phone: res.phone });
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      const detail = isAxiosError(err) ? JSON.stringify(err.response?.data?.detail ?? "") : "";
      setError(
        status === 413 || status === 415
          ? t("form.errors.file")
          : status === 409
            ? t("form.errors.too_many")
            : detail.includes("Contact")
              ? t("form.errors.contact")
              : detail.includes("Phone")
                ? t("form.errors.phone")
                : t("form.errors.generic")
      );
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center space-y-3">
          <CheckCircle2 size={40} className="mx-auto text-teal" aria-hidden />
          <h1 className="text-primary text-lg font-bold">{t("form.done_title")}</h1>
          <p className="text-secondary text-sm">{t("form.done_text", { fee, phone: `+7 ${done.phone.slice(1, 4)} ${done.phone.slice(4, 7)} ${done.phone.slice(7, 9)} ${done.phone.slice(9)}` })}</p>
          <button
            onClick={() => router.push("/offers?tab=mine")}
            className="w-full min-h-11 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover"
          >
            {t("form.done_cta")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push("/offers")}
            aria-label={t("common.back", { ns: "common" })}
            className="-m-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-primary font-bold leading-tight">{t("form.title")}</h1>
            {terms && <p className="text-secondary text-xs">{t("form.subtitle", { fee, days: terms.days })}</p>}
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="max-w-2xl mx-auto px-4 pt-4 pb-24 lg:pb-6 space-y-4">
        <p className="rounded-xl bg-accent/10 border border-accent/20 p-3 text-sm text-primary">{t("form.how")}</p>

        <Field label={t("form.position")}>
          <input name="position" required minLength={2} maxLength={120} className={inputClass} />
        </Field>
        <Field label={t("form.employer")}>
          <input name="employer" required minLength={2} maxLength={120} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("form.state")}>
            <input name="state" required minLength={2} maxLength={40} placeholder="NJ" className={inputClass} />
          </Field>
          <Field label={t("form.city")}>
            <input name="city" required minLength={2} maxLength={80} className={inputClass} />
          </Field>
          <Field label={t("form.start_date")}>
            <input name="start_date" type="date" required className={inputClass} />
          </Field>
          <Field label={t("form.end_date")}>
            <input name="end_date" type="date" required className={inputClass} />
          </Field>
          <Field label={t("form.hourly_wage")}>
            <input name="hourly_wage" type="number" inputMode="decimal" step="0.01" min="1" max="100" required className={inputClass} />
          </Field>
          <Field label={t("form.hours_per_week")}>
            <input name="hours_per_week" type="number" inputMode="numeric" min="1" max="80" required className={inputClass} />
          </Field>
        </div>
        <Field label={t("form.housing")}>
          <input name="housing" maxLength={200} placeholder={t("form.housing_placeholder")} className={inputClass} />
        </Field>
        <Field label={t("form.sponsor")}>
          <input name="sponsor" required minLength={2} maxLength={120} placeholder={t("form.sponsor_placeholder")} className={inputClass} />
        </Field>
        <Field label={t("form.agency")}>
          <input name="agency" maxLength={120} className={inputClass} />
        </Field>
        <Field label={t("form.description")}>
          <textarea
            name="description"
            maxLength={2000}
            rows={3}
            placeholder={t("form.description_placeholder")}
            className={`${inputClass} py-2.5`}
          />
        </Field>
        <Field label={t("form.price")}>
          <input name="price_kzt" type="number" inputMode="numeric" min="0" max="10000000" required className={inputClass} />
        </Field>
        <Field label={t("form.contact")}>
          <input name="contact" required maxLength={100} placeholder={t("form.contact_placeholder")} className={inputClass} />
        </Field>
        <Field label={t("form.phone")}>
          <input name="phone" type="tel" inputMode="tel" required maxLength={30} placeholder="+7 701 123 45 67" className={inputClass} />
        </Field>

        <div className="space-y-1.5">
          <span className="text-sm font-medium text-primary">{t("form.proof")}</span>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-card px-3 py-2.5 text-sm text-primary hover:border-accent">
            <Paperclip size={16} className="shrink-0 text-secondary" aria-hidden />
            <span className="truncate">{file ? file.name : t("form.choose_file")}</span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <span className="block text-xs text-secondary">{t("form.proof_hint")}</span>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={sending}
          className="w-full min-h-12 rounded-xl bg-accent text-white font-semibold hover:bg-accent-hover disabled:opacity-60"
        >
          {sending ? t("form.sending") : t("form.submit")}
        </button>
      </form>
    </div>
  );
}
