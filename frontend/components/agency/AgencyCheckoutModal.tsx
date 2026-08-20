"use client";

import { Check, ExternalLink, X } from "lucide-react";

import { agencyCreatePayment, agencyMockCompletePayment, agencyGetMe } from "@/lib/agency-api";
import { useCheckoutFlow } from "@/hooks/useCheckoutFlow";

interface Props {
  plan: string;
  planLabel: string;
  billingPeriod: "monthly" | "yearly";
  amountLabel: string;
  onClose: () => void;
  onActivated: () => void;
}

/** Agency counterpart of components/pricing/CheckoutModal.tsx — same
 * useCheckoutFlow state machine, styled for this section's own light theme
 * instead of the student app's dark CSS-variable tokens. */
export function AgencyCheckoutModal({ plan, planLabel, billingPeriod, amountLabel, onClose, onActivated }: Props) {
  const { status, payment, qrDataUrl, mobile, startPayment, handleMockComplete } = useCheckoutFlow({
    plan,
    billingPeriod,
    createPayment: agencyCreatePayment,
    mockComplete: agencyMockCompletePayment,
    onActivated,
    getSnapshot: async () => {
      const me = await agencyGetMe();
      return { plan: me.billing.plan ?? null, periodEnd: me.billing.period_end ?? null, active: me.billing.status === "paid" };
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div className="w-full sm:max-w-sm bg-white border border-gray-200 rounded-t-3xl sm:rounded-3xl p-6 relative shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Закрыть"
        >
          <X size={20} />
        </button>

        <h2 className="text-gray-900 font-bold text-lg mb-1 pr-8">{planLabel}</h2>
        <p className="text-gray-500 text-sm mb-5">{amountLabel}</p>

        {status === "creating" && (
          <div className="flex flex-col items-center py-10 gap-3">
            <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Создаём платёж...</p>
          </div>
        )}

        {status === "pending" && payment && (
          <div className="flex flex-col items-center gap-4">
            {payment.mock_mode ? (
              <p className="text-gray-500 text-sm text-center">
                Тестовый режим — нажми кнопку ниже, чтобы симулировать оплату
              </p>
            ) : mobile ? (
              <>
                <p className="text-gray-500 text-sm text-center">Нажми, чтобы открыть приложение Kaspi и оплатить</p>
                <a
                  href={payment.pay_url}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
                >
                  Открыть Kaspi
                  <ExternalLink size={15} />
                </a>
              </>
            ) : (
              <>
                <p className="text-gray-500 text-sm text-center">Отсканируй QR-код в приложении Kaspi</p>
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="QR-код для оплаты" className="w-56 h-56 rounded-xl bg-white p-2 border border-gray-200" />
                ) : (
                  <div className="w-56 h-56 rounded-xl bg-gray-100 animate-pulse" />
                )}
                <a
                  href={payment.pay_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 text-xs flex items-center gap-1"
                >
                  Открыть ссылку напрямую
                  <ExternalLink size={12} />
                </a>
              </>
            )}

            <div className="flex items-center gap-2 text-gray-500 text-xs mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Ждём оплату...
            </div>

            {payment.mock_mode && (
              <button
                onClick={handleMockComplete}
                className="w-full text-xs font-semibold text-gray-500 hover:text-gray-800 border border-dashed border-gray-300 rounded-xl py-2.5 transition-colors"
              >
                Подтвердить тестовый платёж
              </button>
            )}
          </div>
        )}

        {status === "activated" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
              <Check size={26} className="text-emerald-500" />
            </div>
            <p className="text-gray-900 font-semibold">Подписка активирована!</p>
          </div>
        )}

        {status === "expired" && (
          <div className="flex flex-col items-center py-6 gap-4">
            <p className="text-gray-500 text-sm text-center">Платёж истёк — QR действителен ограниченное время</p>
            <button
              onClick={startPayment}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center py-6 gap-4">
            <p className="text-red-500 text-sm text-center">Не удалось создать платёж. Попробуйте ещё раз.</p>
            <button
              onClick={startPayment}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
