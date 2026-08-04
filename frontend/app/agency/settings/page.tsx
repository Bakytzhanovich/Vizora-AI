"use client";

import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { AgencyLayout } from "@/components/agency/AgencyLayout";
import { ColorPicker } from "@/components/branding/ColorPicker";
import { LogoUpload } from "@/components/branding/LogoUpload";
import { WhiteLabelPreview } from "@/components/branding/WhiteLabelPreview";
import { BillingBadge } from "@/components/agency/BillingBadge";
import {
  agencyGetMe,
  agencyUpdateSettings,
  agencyUpdateWhiteLabel,
  agencyUploadLogo,
  agencyLogout,
  type AgencyMe,
} from "@/lib/agency-api";

export default function AgencySettingsPage() {
  const [me, setMe] = useState<AgencyMe | null>(null);
  const [form, setForm] = useState({ name: "", contact_phone: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // White-label state
  const [wlEnabled, setWlEnabled] = useState(false);
  const [wlName, setWlName] = useState("");
  const [wlColor, setWlColor] = useState("#6C63FF");
  const [wlLogoUrl, setWlLogoUrl] = useState<string | null>(null);
  const [wlSaving, setWlSaving] = useState(false);
  const [wlSaved, setWlSaved] = useState(false);
  const [wlError, setWlError] = useState("");

  useEffect(() => {
    agencyGetMe()
      .then((data) => {
        setMe(data);
        setForm({ name: data.name, contact_phone: data.contact_phone ?? "" });
        // White-label fields come from /me
        const anyData = data as AgencyMe & {
          white_label_name?: string;
          white_label_logo_url?: string;
          white_label_primary_color?: string;
          white_label_enabled?: boolean;
        };
        setWlEnabled(anyData.white_label_enabled ?? false);
        setWlName(anyData.white_label_name ?? "");
        setWlColor(anyData.white_label_primary_color ?? "#6C63FF");
        setWlLogoUrl(anyData.white_label_logo_url ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await agencyUpdateSettings({
        name: form.name.trim() || undefined,
        contact_phone: form.contact_phone.trim() || undefined,
      });
      if (form.name.trim()) localStorage.setItem("agency_name", form.name.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  };

  const handleWlSave = async () => {
    setWlError("");
    setWlSaving(true);
    try {
      await agencyUpdateWhiteLabel({
        white_label_name: wlName.trim() || form.name,
        primary_color: wlColor,
        enabled: wlEnabled,
      });
      setWlSaved(true);
      setTimeout(() => setWlSaved(false), 2500);
    } catch {
      setWlError("Не удалось сохранить настройки брендинга");
    } finally {
      setWlSaving(false);
    }
  };

  if (loading) {
    return (
      <AgencyLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-9 h-9 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </AgencyLayout>
    );
  }

  return (
    <AgencyLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
        <p className="text-sm text-gray-500 mt-0.5">Управление профилем агентства</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Main info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-5">Профиль агентства</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Название агентства</label>
              <input
                type="text"
                value={form.name}
                onChange={set("name")}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Контактный телефон</label>
              <input
                type="tel"
                value={form.contact_phone}
                onChange={set("contact_phone")}
                placeholder="+7 777 000 0000"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? "Сохраняем..." : saved ? <><Check size={15} /> Сохранено</> : "Сохранить"}
            </button>
          </form>
        </div>

        {/* ─── White-label Branding ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-blue-600" />
            <h2 className="font-semibold text-gray-900">White-label брендинг</h2>
          </div>
          <p className="text-xs text-gray-400 mb-5">
            Студенты увидят ваш бренд вместо &quot;Vizora AI&quot;
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-between mb-5 pb-5 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Включить White-label</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {wlEnabled ? "Студенты видят ваш бренд" : "Студенты видят Vizora AI"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWlEnabled((v) => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                wlEnabled ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  wlEnabled ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className={`space-y-5 ${!wlEnabled ? "opacity-40 pointer-events-none" : ""}`}>
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Название для студентов
              </label>
              <input
                type="text"
                value={wlName}
                onChange={(e) => setWlName(e.target.value)}
                placeholder="Например: AI-помощник от KCET"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Основной цвет
              </label>
              <ColorPicker value={wlColor} onChange={setWlColor} />
            </div>

            {/* Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Логотип</label>
              <LogoUpload
                currentUrl={wlLogoUrl}
                onUploaded={(url) => setWlLogoUrl(url || null)}
                onUpload={agencyUploadLogo}
              />
            </div>
          </div>

          {/* Live preview */}
          <div className="mt-6">
            <p className="text-sm font-medium text-gray-700 mb-3">Предпросмотр у студента</p>
            <WhiteLabelPreview
              name={wlEnabled && wlName ? wlName : "Vizora AI"}
              logoUrl={wlEnabled ? wlLogoUrl : null}
              primaryColor={wlEnabled ? wlColor : "#6C63FF"}
              isWhiteLabel={wlEnabled}
            />
          </div>

          {wlError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {wlError}
            </div>
          )}

          <button
            type="button"
            onClick={handleWlSave}
            disabled={wlSaving}
            className="mt-5 flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50"
          >
            {wlSaving ? "Сохраняем..." : wlSaved ? (
              <><Check size={15} /> Брендинг обновлён!</>
            ) : "Сохранить брендинг"}
          </button>
          {wlSaved && (
            <p className="text-xs text-gray-400 mt-2">
              Студенты увидят изменения при следующем входе.
            </p>
          )}
        </div>

        {/* Account info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Информация об аккаунте</h2>
          <div className="space-y-3">
            {[
              { label: "Email", value: me?.email },
              { label: "Страна", value: me?.country },
              {
                label: "Дата регистрации",
                value: me?.created_at
                  ? new Date(me.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
                  : "—",
              },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">{label}</span>
                <span className="text-sm font-medium text-gray-900 capitalize">{value}</span>
              </div>
            ))}
            {me?.billing && (
              <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">Тарифный план</span>
                <BillingBadge billing={me.billing} />
              </div>
            )}
          </div>
        </div>

        {/* Logout */}
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Действия</h2>
          <p className="text-xs text-gray-400 mb-4">Выйти из кабинета агентства</p>
          <button
            onClick={agencyLogout}
            className="px-5 py-2.5 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition"
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </AgencyLayout>
  );
}
