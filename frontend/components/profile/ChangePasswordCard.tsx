"use client";

import { useState } from "react";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { apiChangePassword } from "@/lib/api";

const inputClass =
  "w-full min-h-11 rounded-xl bg-bg border border-border px-3 text-base text-primary placeholder:text-secondary focus:border-accent outline-none";

export function ChangePasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const { t } = useTranslation("profile");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  // The account has one from now on, even before /profile/me is reloaded.
  const [hasPw, setHasPw] = useState(hasPassword);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) {
      setResult({ ok: false, text: t("password.too_short") });
      return;
    }
    setSaving(true);
    setResult(null);
    try {
      await apiChangePassword(current, next);
      setCurrent("");
      setNext("");
      setHasPw(true);
      setResult({ ok: true, text: t("password.saved") });
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      setResult({
        ok: false,
        text: status === 400 ? t("password.wrong_current") : status === 422 ? t("password.too_short") : t("password.error"),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-5 space-y-3">
      <div>
        <h2 className="text-primary font-semibold text-sm">{t(hasPw ? "password.title" : "password.title_new")}</h2>
        <p className="text-secondary text-xs mt-1">{t("password.hint")}</p>
      </div>
      {hasPw && (
        <label className="block space-y-1.5">
          <span className="text-sm text-primary">{t("password.current")}</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={inputClass}
          />
        </label>
      )}
      <label className="block space-y-1.5">
        <span className="text-sm text-primary">{t("password.new")}</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className={inputClass}
        />
      </label>
      {result && (
        <p role="status" className={`text-sm ${result.ok ? "text-teal" : "text-error"}`}>
          {result.text}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="w-full min-h-11 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-60"
      >
        {saving ? t("password.saving") : t("password.save")}
      </button>
    </form>
  );
}
