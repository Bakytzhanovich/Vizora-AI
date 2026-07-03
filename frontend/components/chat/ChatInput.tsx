"use client";

import { useRef, useState } from "react";
import { Send, Mic } from "lucide-react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    onSend(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 bg-[#13131A] border border-[#1E1E2E] rounded-2xl px-4 py-3 focus-within:border-[#6C63FF]/50 transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Задай любой вопрос по Work & Travel..."
          rows={1}
          disabled={disabled}
          className="w-full bg-transparent text-[#F0F0FF] placeholder-[#8B8BA7] text-sm resize-none outline-none leading-relaxed disabled:opacity-50"
          style={{ maxHeight: "120px" }}
        />
      </div>

      {/* Voice button — disabled */}
      <div className="relative group">
        <button
          disabled
          className="w-11 h-11 rounded-xl bg-[#13131A] border border-[#1E1E2E] flex items-center justify-center text-[#8B8BA7] opacity-50 cursor-not-allowed"
        >
          <Mic size={18} />
        </button>
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#13131A] border border-[#1E1E2E] text-[#8B8BA7] text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Скоро
        </div>
      </div>

      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="w-11 h-11 rounded-xl bg-[#6C63FF] hover:bg-[#7C75FF] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all duration-200 shrink-0"
      >
        <Send size={16} />
      </button>
    </div>
  );
}
