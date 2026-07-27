"use client";

import { useRouter } from "next/navigation";

/** Shown once an expired-trial user hits the 3-question/day FAQ cap. */
export function FaqLimitCard() {
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto mb-3 rounded-2xl border border-[#6C63FF]/30 bg-[#13131A] p-4 text-center">
      <div className="text-2xl mb-2">💬</div>
      <p className="text-[#F0F0FF] font-semibold text-sm mb-1">Лимит вопросов на сегодня</p>
      <p className="text-[#8B8BA7] text-xs mb-1">Бесплатно: 3 вопроса в день</p>
      <p className="text-[#8B8BA7] text-xs mb-4">Обновится завтра в 00:00</p>
      <p className="text-[#8B8BA7] text-xs mb-3">Подпишись для безлимитного доступа</p>
      <button
        onClick={() => router.push("/pricing")}
        className="w-full py-2.5 rounded-xl text-sm font-semibold bg-[#6C63FF] hover:bg-[#7C75FF] text-white transition-colors"
      >
        Выбрать план →
      </button>
    </div>
  );
}
