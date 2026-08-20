"use client";

import { Check, ExternalLink, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { apiCreatePayment, apiMockCompletePayment, apiGetMe } from "@/lib/api";
import { useCheckoutFlow } from "@/hooks/useCheckoutFlow";

interface Props {
  plan: string;
  planLabel: string;
  billingPeriod: "monthly" | "yearly";
  amountLabel: string;
  onClose: () => void;
  onActivated: () => void;
}

export function CheckoutModal({ plan, planLabel, billingPeriod, amountLabel, onClose, onActivated }: Props) {
  const { t } = useTranslation("pricing");

  const { status, payment, qrDataUrl, mobile, startPayment, handleMockComplete } = useCheckoutFlow({
    plan,
    billingPeriod,
    createPayment: apiCreatePayment,
    mockComplete: apiMockCompletePayment,
    onActivated,
    getSnapshot: async () => {
      const me = await apiGetMe();
      return { plan: me.subscription?.plan ?? null, periodEnd: me.subscription?.period_end ?? null, active: true };
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div className="w-full sm:max-w-sm bg-card border border-border rounded-t-3xl sm:rounded-3xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-secondary hover:text-primary transition-colors"
          aria-label={t("checkout.close_aria")}
        >
          <X size={20} />
        </button>

        <h2 className="text-primary font-bold text-lg mb-1 pr-8">{planLabel}</h2>
        <p className="text-secondary text-sm mb-5">{amountLabel}</p>

        {status === "creating" && (
          <div className="flex flex-col items-center py-10 gap-3">
            <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <p className="text-secondary text-sm">{t("checkout.creating")}</p>
          </div>
        )}

        {status === "pending" && payment && (
          <div className="flex flex-col items-center gap-4">
            {payment.mock_mode ? (
              <p className="text-secondary text-sm text-center">{t("checkout.mock_hint")}</p>
            ) : mobile ? (
              <>
                <p className="text-secondary text-sm text-center">{t("checkout.mobile_hint")}</p>
                <a
                  href={payment.pay_url}
                  className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold text-sm py-3 rounded-xl transition-colors"
                >
                  {t("checkout.open_kaspi")}
                  <ExternalLink size={15} />
                </a>
              </>
            ) : (
              <>
                <p className="text-secondary text-sm text-center">{t("checkout.desktop_hint")}</p>
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt={t("checkout.qr_alt")} className="w-56 h-56 rounded-xl bg-white p-2" />
                ) : (
                  <div className="w-56 h-56 rounded-xl bg-border animate-pulse" />
                )}
                <a
                  href={payment.pay_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent-light text-xs flex items-center gap-1"
                >
                  {t("checkout.open_link")}
                  <ExternalLink size={12} />
                </a>
              </>
            )}

            <div className="flex items-center gap-2 text-secondary text-xs mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
              {t("checkout.waiting")}
            </div>

            {payment.mock_mode && (
              <button
                onClick={handleMockComplete}
                className="w-full text-xs font-semibold text-secondary hover:text-primary border border-dashed border-border-hover rounded-xl py-2.5 transition-colors"
              >
                {t("checkout.mock_complete")}
              </button>
            )}
          </div>
        )}

        {status === "activated" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="w-14 h-14 rounded-full bg-teal/15 flex items-center justify-center">
              <Check size={26} className="text-teal" />
            </div>
            <p className="text-primary font-semibold">{t("checkout.activated")}</p>
          </div>
        )}

        {status === "expired" && (
          <div className="flex flex-col items-center py-6 gap-4">
            <p className="text-secondary text-sm text-center">{t("checkout.expired")}</p>
            <button
              onClick={startPayment}
              className="w-full bg-accent hover:bg-accent-hover text-white font-semibold text-sm py-3 rounded-xl transition-colors"
            >
              {t("checkout.retry")}
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center py-6 gap-4">
            <p className="text-error text-sm text-center">{t("checkout.error")}</p>
            <button
              onClick={startPayment}
              className="w-full bg-accent hover:bg-accent-hover text-white font-semibold text-sm py-3 rounded-xl transition-colors"
            >
              {t("checkout.retry")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
