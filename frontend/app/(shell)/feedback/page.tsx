"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { ArrowLeft, Bug, CheckCircle2, HelpCircle, Lightbulb } from "lucide-react";
import { useTranslation } from "react-i18next";

import { apiSendFeedback, type FeedbackKind } from "@/lib/api";

const KINDS: { id: FeedbackKind; icon: typeof Bug }[] = [
  { id: "idea", icon: Lightbulb },
  { id: "bug", icon: Bug },
  { id: "question", icon: HelpCircle },
];

export default function FeedbackPage() {
  const router = useRouter();
  const { t } = useTranslation("feedback");
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) router.replace("/login");
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await apiSendFeedback(kind, message.trim(), document.referrer ? new URL(document.referrer).pathname : undefined);
      setSent(true);
    } catch (err) {
      setError(isAxiosError(err) && err.response?.status === 429 ? t("error_limit") : t("error"));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center space-y-3">
          <CheckCircle2 size={40} className="mx-auto text-teal" aria-hidden />
          <h1 className="text-primary text-lg font-bold">{t("done_title")}</h1>
          <p className="text-secondary text-sm">{t("done_text")}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full min-h-11 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover"
          >
            {t("done_cta")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label={t("common.back", { ns: "common" })}
            className="-m-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-primary font-bold leading-tight">{t("title")}</h1>
            <p className="text-secondary text-xs">{t("subtitle")}</p>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="max-w-2xl mx-auto px-4 pt-4 pb-24 lg:pb-6 space-y-4">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("kind_label")}>
          {KINDS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={kind === id}
              onClick={() => setKind(id)}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-sm font-medium transition-colors ${
                kind === id ? "border-accent bg-accent/10 text-accent" : "border-border bg-card text-secondary hover:text-primary"
              }`}
            >
              <Icon size={18} aria-hidden />
              {t(`kinds.${id}`)}
            </button>
          ))}
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-primary">{t("message_label")}</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            minLength={3}
            maxLength={2000}
            rows={6}
            placeholder={t(`placeholders.${kind}`)}
            className="w-full rounded-xl bg-card border border-border px-3 py-2.5 text-base text-primary placeholder:text-secondary focus:border-accent outline-none"
          />
        </label>

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={sending || message.trim().length < 3}
          className="w-full min-h-12 rounded-xl bg-accent text-white font-semibold hover:bg-accent-hover disabled:opacity-60"
        >
          {sending ? t("sending") : t("submit")}
        </button>
      </form>
    </div>
  );
}
