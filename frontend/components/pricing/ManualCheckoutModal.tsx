"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { apiCreateManualPaymentRequest, apiGetManualPaymentRequest, type ManualPaymentRequest } from "@/lib/api";

// What the student is promised on the "request accepted" screen. Change it
// together with how quickly invoices are actually sent from Kaspi Pay.
const INVOICE_WITHIN_HOURS = 2;

const PHONE_STORAGE_KEY = "vizora_kaspi_phone";

interface Props {
  plan: string;
  planLabel: string;
  billingPeriod: "monthly" | "yearly";
  amountLabel: string;
  onClose: () => void;
}

function formatPhone(digits: string): string {
  const d = digits.padEnd(11, " ");
  return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`.trim();
}

function isKzPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return /^[78]?7\d{9}$/.test(digits) && digits.length >= 10;
}

export function ManualCheckoutModal({ plan, planLabel, billingPeriod, amountLabel, onClose }: Props) {
  const { t } = useTranslation("pricing");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"form" | "sending" | "sent" | "error">("form");
  const [request, setRequest] = useState<ManualPaymentRequest | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    try {
      setPhone(localStorage.getItem(PHONE_STORAGE_KEY) ?? "");
    } catch {
      // localStorage unavailable (private mode) — the field just starts empty.
    }
  }, []);

  const valid = isKzPhone(phone);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setStatus("sending");
    try {
      const created = await apiCreateManualPaymentRequest(plan, billingPeriod, phone);
      try {
        localStorage.setItem(PHONE_STORAGE_KEY, phone);
      } catch {
        // Not remembering the phone is fine.
      }
      setRequest(created);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  // Re-opening the modal for the same plan while a request is open shows its
  // status instead of an empty form.
  useEffect(() => {
    apiGetManualPaymentRequest()
      .then((existing) => {
        if (existing && existing.plan === plan && existing.billing_period === billingPeriod) {
          setRequest(existing);
          setPhone(formatPhone(existing.phone));
          setStatus("sent");
        }
      })
      .catch(() => {});
  }, [plan, billingPeriod]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-checkout-title"
        className="w-full sm:max-w-sm bg-card border border-border rounded-t-3xl sm:rounded-3xl p-6 relative"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-xl text-secondary hover:text-primary transition-colors"
          aria-label={t("checkout.close_aria")}
        >
          <X size={20} />
        </button>

        <h2 id="manual-checkout-title" className="text-primary font-bold text-lg mb-1 pr-10">
          {planLabel}
        </h2>
        <p className="text-secondary text-sm mb-5">{amountLabel}</p>

        {(status === "form" || status === "sending" || status === "error") && (
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <div>
              <label htmlFor="kaspi-phone" className="block text-sm font-semibold text-primary mb-2">
                {t("manual.phone_label")}
              </label>
              <input
                id="kaspi-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder={t("manual.phone_placeholder")}
                aria-invalid={touched && !valid}
                aria-describedby="kaspi-phone-help"
                className="w-full min-h-12 rounded-xl border border-border bg-bg px-4 text-base text-primary placeholder:text-secondary/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              <p id="kaspi-phone-help" className={`mt-2 text-xs ${touched && !valid ? "text-error" : "text-secondary"}`}>
                {touched && !valid ? t("manual.phone_invalid") : t("manual.how")}
              </p>
            </div>

            {status === "error" && <p className="text-error text-sm">{t("manual.error")}</p>}

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full min-h-12 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-semibold text-sm rounded-xl transition-colors"
            >
              {status === "sending" ? t("manual.sending") : t("manual.submit")}
            </button>
          </form>
        )}

        {status === "sent" && request && (
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <div className="w-14 h-14 rounded-full bg-teal/15 flex items-center justify-center">
              <Check size={26} className="text-teal" />
            </div>
            <p className="text-primary font-semibold">{t("manual.sent_title")}</p>
            <p className="text-secondary text-sm leading-relaxed">
              {t("manual.sent_text", {
                hours: INVOICE_WITHIN_HOURS,
                amount: new Intl.NumberFormat("ru-RU").format(request.amount) + " ₸",
              })}
            </p>
            <p className="text-primary text-sm font-medium">{t("manual.sent_phone", { phone: formatPhone(request.phone) })}</p>
            <div className="flex w-full flex-col gap-2 mt-2">
              <button
                onClick={onClose}
                className="w-full min-h-12 bg-accent hover:bg-accent-hover text-white font-semibold text-sm rounded-xl transition-colors"
              >
                {t("manual.done")}
              </button>
              <button
                onClick={() => setStatus("form")}
                className="w-full min-h-11 text-sm font-medium text-secondary hover:text-primary transition-colors"
              >
                {t("manual.change_phone")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
