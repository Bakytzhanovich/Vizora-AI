"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

const POLL_MS = 3000;
// Matches what the real Kaspi QR is actually valid for (observed: ~5 min from
// creation) — no point polling past that, the payment is dead either way.
const EXPIRE_MS = 5 * 60 * 1000;

export function isMobileDevice(): boolean {
  return typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export type CheckoutStatus = "creating" | "pending" | "activated" | "expired" | "error";

interface PaymentLike {
  payment_id: string;
  pay_url: string;
  mock_mode: boolean;
}

/** Current plan/period_end (+ any extra "is this actually live" check, e.g.
 * agency billing.status === "paid") — diffed against a pre-checkout baseline
 * so a renewal of an already-active plan, or an unrelated concurrent change
 * landing on the same plan id, can't be mistaken for *this* payment clearing. */
interface StatusSnapshot {
  plan: string | null;
  periodEnd: string | null;
  active: boolean;
}

interface Params<TPayment extends PaymentLike> {
  plan: string;
  billingPeriod: "monthly" | "yearly";
  createPayment: (plan: string, billingPeriod: "monthly" | "yearly") => Promise<TPayment>;
  getSnapshot: () => Promise<StatusSnapshot>;
  mockComplete: (paymentId: string) => Promise<unknown>;
  onActivated: () => void;
}

/** Shared create/poll/expire/mock-complete state machine behind both
 * CheckoutModal (student) and AgencyCheckoutModal — only the API calls and
 * rendering differ between the two. */
export function useCheckoutFlow<TPayment extends PaymentLike>({
  plan,
  billingPeriod,
  createPayment,
  getSnapshot,
  mockComplete,
  onActivated,
}: Params<TPayment>) {
  const [status, setStatus] = useState<CheckoutStatus>("creating");
  const [payment, setPayment] = useState<TPayment | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [mobile] = useState(isMobileDevice);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const expireTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const baseline = useRef<{ plan: string | null; periodEnd: string | null } | null>(null);

  const stopTimers = () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    if (expireTimer.current) clearTimeout(expireTimer.current);
  };

  const startPayment = async () => {
    setStatus("creating");
    setPayment(null);
    setQrDataUrl(null);
    stopTimers();

    try {
      // Baseline must be known before polling starts — if we can't read
      // current state (transient network hiccup, expired token mid-checkout),
      // fail closed instead of polling against a null baseline, which would
      // make the very next matching snapshot look like "just activated" even
      // if the user already owned the plan before this checkout began.
      const [result, snapshot] = await Promise.all([createPayment(plan, billingPeriod), getSnapshot()]);
      if (!mounted.current) return;
      baseline.current = { plan: snapshot.plan, periodEnd: snapshot.periodEnd };
      setPayment(result);
      setStatus("pending");

      if (!mobile && !result.mock_mode) {
        QRCode.toDataURL(result.pay_url, { width: 240, margin: 1 }).then((url) => {
          if (mounted.current) setQrDataUrl(url);
        }).catch(() => {});
      }

      pollTimer.current = setInterval(async () => {
        try {
          const snap = await getSnapshot();
          if (!mounted.current) return;
          const changed =
            snap.plan !== baseline.current?.plan || snap.periodEnd !== baseline.current?.periodEnd;
          if (snap.active && snap.plan === plan && changed) {
            stopTimers();
            setStatus("activated");
            setTimeout(() => {
              if (mounted.current) onActivated();
            }, 1200);
          }
        } catch {
          // transient network hiccup — next tick retries
        }
      }, POLL_MS);

      expireTimer.current = setTimeout(() => {
        stopTimers();
        setStatus((s) => (s === "pending" ? "expired" : s));
      }, EXPIRE_MS);
    } catch {
      if (mounted.current) setStatus("error");
    }
  };

  useEffect(() => {
    mounted.current = true;
    startPayment();
    return () => {
      mounted.current = false;
      stopTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, billingPeriod]);

  const handleMockComplete = async () => {
    if (!payment) return;
    try {
      await mockComplete(payment.payment_id);
      if (!mounted.current) return;
      stopTimers();
      setStatus("activated");
      setTimeout(() => {
        if (mounted.current) onActivated();
      }, 1200);
    } catch {
      if (mounted.current) setStatus("error");
    }
  };

  return { status, payment, qrDataUrl, mobile, startPayment, handleMockComplete };
}
