"use client";

import { motion } from "framer-motion";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Props {
  message: Message;
  index: number;
}

export function ChatMessage({ message, index }: Props) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.05, 0.3) }}
      className={`flex items-end gap-2 mb-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-[#6C63FF]/20 border border-[#6C63FF]/30 flex items-center justify-center shrink-0 text-sm mb-0.5">
          🤖
        </div>
      )}

      <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {!isUser && (
          <span className="text-[#8B8BA7] text-xs px-1">Vizora AI</span>
        )}
        <div
          className={`px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? "bg-[#6C63FF] text-white rounded-2xl rounded-br-sm"
              : "bg-[#13131A] border border-[#1E1E2E] text-[#F0F0FF] rounded-2xl rounded-tl-sm"
          }`}
        >
          {message.content}
        </div>
      </div>
    </motion.div>
  );
}
