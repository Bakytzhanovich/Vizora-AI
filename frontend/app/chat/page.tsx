"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trash2 } from "lucide-react";

import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { QuickQuestions } from "@/components/chat/QuickQuestions";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { PoweredByFooter } from "@/components/branding/PoweredByFooter";
import { useBranding } from "@/hooks/useBranding";
import { track } from "@/lib/analytics";
import { fetchWithAuth } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function makeId() {
  return Math.random().toString(36).slice(2);
}

export default function ChatPage() {
  const router = useRouter();
  const { branding } = useBranding();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [userName, setUserName] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sessionId] = useState(() => makeId());
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load history on mount
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    const name = localStorage.getItem("user_name") || "";
    setUserName(name);

    fetchWithAuth(`${API_URL}/api/chat/history?limit=50`)
      .then((r) => r.json())
      .then((data) => {
        if (data.messages?.length) {
          setMessages(
            data.messages.map((m: { id: string; role: "user" | "assistant"; content: string }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            }))
          );
        }
        setHistoryLoaded(true);
      })
      .catch((err: unknown) => {
        // If session expired, fetchWithAuth already redirected — don't trigger a
        // re-render that would flash an empty chat before the browser navigates away.
        if ((err as Error)?.message !== "Session expired") {
          setHistoryLoaded(true);
        }
      });
  }, [router]);

  useEffect(() => {
    if (historyLoaded) scrollToBottom();
  }, [historyLoaded, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(async (text: string) => {
    if (isStreaming) return;

    track("chat_message_sent");
    const userMsg: Message = { id: makeId(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    const assistantId = makeId();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    try {
      const response = await fetchWithAuth(`${API_URL}/api/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No stream");

      // Add empty assistant message placeholder
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: accumulated } : m
          )
        );
        scrollToBottom();
      }
    } catch {
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== assistantId)
          .concat({
            id: assistantId,
            role: "assistant",
            content: "Что-то пошло не так. Попробуй ещё раз.",
          })
      );
    } finally {
      reader?.cancel();
      setIsStreaming(false);
    }
  }, [isStreaming, sessionId, scrollToBottom]);

  const clearHistory = async () => {
    await fetchWithAuth(`${API_URL}/api/chat/history`, { method: "DELETE" });
    setMessages([]);
  };

  const isEmpty = messages.length === 0 && historyLoaded;

  return (
    <div className="flex flex-col h-screen bg-[#0A0A0F]">
      <PoweredByFooter />
      {/* Header */}
      <div className="shrink-0 bg-[#0A0A0F]/90 backdrop-blur border-b border-[#1E1E2E] px-4 py-3.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-[#8B8BA7] hover:text-[#F0F0FF] transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#6C63FF]/20 border border-[#6C63FF]/30 flex items-center justify-center text-sm">
                🤖
              </div>
              <div>
                <div className="text-[#F0F0FF] font-semibold text-sm leading-none">
                  AI Помощник
                </div>
                <div className="text-[#00D4AA] text-xs mt-0.5">онлайн</div>
              </div>
            </div>
          </div>

          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-[#8B8BA7] hover:text-[#FF6B6B] transition-colors p-1.5"
              title="Очистить историю"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto">
          {/* Empty state */}
          <AnimatePresence>
            {isEmpty && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-6"
              >
                <div>
                  <div className="text-5xl mb-4">🤖</div>
                  <h2 className="text-xl font-bold text-[#F0F0FF] mb-2">
                    Привет{userName ? `, ${userName}` : ""}! Я {branding.name}
                  </h2>
                  <p className="text-[#8B8BA7] text-sm max-w-xs">
                    Задай любой вопрос по Work & Travel USA — отвечу быстро и по делу
                  </p>
                </div>
                <QuickQuestions onSelect={sendMessage} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message list */}
          {messages.map((msg, i) => (
            <ChatMessage key={msg.id} message={msg} index={i} />
          ))}

          {/* Typing indicator — show only when streaming and last message is user */}
          {isStreaming &&
            messages.length > 0 &&
            messages[messages.length - 1].role === "user" && (
              <TypingIndicator />
            )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Quick questions — show below messages when has history */}
      {!isEmpty && !isStreaming && (
        <div className="shrink-0 px-4 pb-2">
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {["Документы?", "Почему отказ?", "SEVIS сбор?", "Job Offer?"].map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="shrink-0 text-xs text-[#8B8BA7] border border-[#1E1E2E] rounded-full px-3 py-1.5 hover:border-[#6C63FF] hover:text-[#F0F0FF] transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-[#1E1E2E] bg-[#0A0A0F] px-4 py-3 pb-safe">
        <div className="max-w-2xl mx-auto">
          <ChatInput onSend={sendMessage} disabled={isStreaming} />
        </div>
      </div>
    </div>
  );
}
