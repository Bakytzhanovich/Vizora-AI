"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

interface ReferralLinkBoxProps {
  code: string;
  link: string;
}

const SHARE_TEXT =
  "Готовлюсь к интервью на визу J-1 с Vizora AI — крутой AI-помощник для Work & Travel. Попробуй тоже:";

export function ReferralLinkBox({ code, link }: ReferralLinkBoxProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      track("referral_copy");
    } catch {
      /* fallback: select input */
    }
  };

  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(SHARE_TEXT)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${link}`)}`;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <p className="text-secondary text-xs font-semibold uppercase tracking-wide mb-3">
        Твоя реферальная ссылка
      </p>

      {/* Code display */}
      <div className="flex items-center gap-3 bg-bg border border-border rounded-xl px-4 py-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-secondary text-[10px] mb-0.5">Код</p>
          <p className="text-accent font-bold text-lg tracking-widest">{code}</p>
          <p className="text-secondary text-xs truncate mt-0.5">{link}</p>
        </div>
        <button
          onClick={handleCopy}
          className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            copied
              ? "bg-teal/20 text-teal border border-teal/40"
              : "bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25"
          }`}
        >
          {copied ? "✓ Скопировано!" : "📋 Копировать"}
        </button>
      </div>

      {/* Share buttons */}
      <p className="text-secondary text-xs mb-2">Поделиться:</p>
      <div className="flex gap-2">
        <a
          href={telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("referral_share", { channel: "telegram" })}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#229ED9]/15 text-[#229ED9] border border-[#229ED9]/30 text-sm font-semibold hover:bg-[#229ED9]/25 transition-colors"
        >
          <span>✈</span> Telegram
        </a>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("referral_share", { channel: "whatsapp" })}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 text-sm font-semibold hover:bg-[#25D366]/25 transition-colors"
        >
          <span>💬</span> WhatsApp
        </a>
      </div>
    </div>
  );
}
