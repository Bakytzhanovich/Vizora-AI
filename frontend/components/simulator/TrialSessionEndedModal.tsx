"use client";

import { useRouter } from "next/navigation";

interface Props {
  answered: number;
  total: number;
}

const MISSED_TOPICS = [
  "Про финансирование поездки",
  "Про возвращение домой",
  "Про твои связи с Казахстаном",
];

/** Full-screen upgrade prompt shown the instant a FREE-plan session hits its
 * time cap mid-conversation (see /simulator/respond's trial_session_ended
 * response) — replaces the interview screen entirely rather than layering
 * over it, since there's no session left to return to. */
export function TrialSessionEndedModal({ answered, total }: Props) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0F] flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div className="text-5xl mb-4">⏸️</div>
        <h1 className="text-xl font-bold text-[#F0F0FF] mb-2">Пробная сессия закончилась</h1>
        <p className="text-[#8B8BA7] text-sm mb-6">
          Ты ответил на {answered} вопрос{answered === 1 ? "" : answered < 5 ? "а" : "ов"} из {total}.
        </p>

        <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-4 mb-6 text-left">
          <p className="text-[#F0F0FF] text-sm font-semibold mb-2">
            В полной сессии ещё {Math.max(total - answered, 0)} вопросов:
          </p>
          <ul className="space-y-1 mb-2">
            {MISSED_TOPICS.map((topic) => (
              <li key={topic} className="text-[#8B8BA7] text-sm flex items-start gap-2">
                <span className="text-[#6C63FF] shrink-0">-</span>
                {topic}
              </li>
            ))}
          </ul>
          <p className="text-[#8B8BA7] text-xs">Это именно то, что спросит консул.</p>
        </div>

        <button
          onClick={() => router.push("/pricing")}
          className="w-full bg-gradient-to-r from-[#6C63FF] to-[#9C8BFF] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#6C63FF]/20 text-sm transition-transform hover:scale-[1.01]"
        >
          Продолжить подготовку →
        </button>
      </div>
    </div>
  );
}
