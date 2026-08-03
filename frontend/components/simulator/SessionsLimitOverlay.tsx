"use client";

import { useRouter } from "next/navigation";

interface Props {
  planLabel: string;
  sessionsUsed: number;
  sessionsLimit: number;
  /** true for FREE's 1-session lifetime cap (never resets); false for a
   * paid plan's monthly quota (Standard: 5/month). */
  neverResets?: boolean;
  onWait: () => void;
}

function nextMonthResetLabel(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** Shown over the simulator's mode-select screen once a plan's session quota
 * is used up — either FREE's one-time lifetime session, or a paid plan's
 * monthly quota (e.g. Standard: 5/month). */
export function SessionsLimitOverlay({ planLabel, sessionsUsed, sessionsLimit, neverResets = false, onWait }: Props) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-6 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="text-lg font-bold text-[#F0F0FF] mb-4">Сессии закончились</h2>

        <div className="bg-[#0A0A0F] rounded-xl p-3 mb-4 text-sm">
          <p className="text-[#8B8BA7]">
            В плане <span className="text-[#F0F0FF] font-semibold">{planLabel}</span>: {sessionsLimit}{" "}
            {sessionsLimit === 1 ? "сессия" : "сессии"}
            {neverResets ? "" : "/мес"}
          </p>
          <p className="text-[#F0F0FF] font-semibold mt-1">
            Ты использовал: {sessionsUsed}/{sessionsLimit}
          </p>
        </div>

        {!neverResets && (
          <p className="text-xs text-[#8B8BA7] mb-5">Следующее обновление: {nextMonthResetLabel()}</p>
        )}

        <p className="text-xs text-[#8B8BA7] mb-4">
          Или апгрейд на <span className="text-[#F0F0FF] font-semibold">Стандарт</span>: больше сессий в месяц
        </p>

        <div className="flex gap-2.5">
          <button
            onClick={() => router.push("/pricing")}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#6C63FF] hover:bg-[#7C75FF] text-white transition-colors"
          >
            Апгрейд →
          </button>
          <button
            onClick={onWait}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#1E1E2E] hover:bg-[#2A2A3A] text-[#F0F0FF] transition-colors"
          >
            Подождать
          </button>
        </div>
      </div>
    </div>
  );
}
