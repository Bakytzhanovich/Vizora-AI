"use client";

import { useRouter } from "next/navigation";
import { Timer } from "lucide-react";

interface Props {
  answered: number;
  total: number;
  onSeeResults: () => void;
}

/** Full-screen upgrade prompt shown the instant a FREE-plan session hits its
 * time cap mid-conversation (see /simulator/respond's trial_session_ended
 * response) — replaces the interview screen entirely rather than layering
 * over it, since there's no session left to return to. */
export function TrialSessionEndedModal({ answered, total, onSeeResults }: Props) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0F] flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-full bg-[#6C63FF]/15 flex items-center justify-center mx-auto mb-4">
          <Timer size={26} className="text-[#6C63FF]" />
        </div>
        <h1 className="text-xl font-bold text-[#F0F0FF] mb-2">Бесплатная сессия — 3 минуты</h1>
        <p className="text-[#8B8BA7] text-sm mb-1">
          Ты успел ответить на {answered} вопрос{answered === 1 ? "" : answered < 5 ? "а" : "ов"}.
        </p>
        <p className="text-[#8B8BA7] text-sm mb-6">В реальном интервью их {total}+.</p>

        <p className="text-[#F0F0FF] text-sm font-semibold mb-3">Продолжи подготовку с СТАНДАРТ:</p>

        <button
          onClick={() => router.push("/pricing")}
          className="w-full bg-gradient-to-r from-[#6C63FF] to-[#9C8BFF] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#6C63FF]/20 text-sm transition-transform hover:scale-[1.01] mb-3"
        >
          Подписаться →
        </button>
        <button
          onClick={onSeeResults}
          className="w-full text-[#8B8BA7] hover:text-[#F0F0FF] text-sm font-medium py-2 transition-colors"
        >
          Завершить и посмотреть результат
        </button>
      </div>
    </div>
  );
}
