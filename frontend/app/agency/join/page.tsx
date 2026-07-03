"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { agencyGetJoinInfo, agencyJoin } from "@/lib/agency-api";

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [info, setInfo] = useState<{ agency_name: string; invitee_name: string; email: string } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({ name: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setLoadError("Неверная ссылка приглашения.");
      return;
    }
    agencyGetJoinInfo(token)
      .then((data) => {
        setInfo(data);
        setForm((p) => ({ ...p, name: data.invitee_name }));
      })
      .catch((e) => {
        const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        if (detail === "Invite token expired") {
          setLoadError("Срок действия приглашения истёк (7 дней). Попросите нового приглашения.");
        } else if (detail === "Invitation already used") {
          setLoadError("Это приглашение уже было использовано. Войдите в систему.");
        } else {
          setLoadError("Неверная или истёкшая ссылка приглашения.");
        }
      });
  }, [token]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    setLoading(true);
    try {
      await agencyJoin({ token, password: form.password, name: form.name.trim() });
      router.push("/agency/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Ошибка создания аккаунта");
    } finally {
      setLoading(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Ссылка недействительна</h1>
          <p className="text-sm text-gray-500 mb-6">{loadError}</p>
          <a href="/agency/login" className="text-blue-600 text-sm hover:underline">
            Войти в кабинет
          </a>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-9 h-9 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="text-blue-600 font-black text-2xl">◈</span>
            <span className="font-bold text-gray-900 text-xl">{info.agency_name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Вас пригласили в команду</h1>
          <p className="text-gray-500 text-sm">
            Создайте аккаунт менеджера для <strong>{info.agency_name}</strong>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ваше имя</label>
              <input
                type="text"
                value={form.name}
                onChange={set("name")}
                required
                autoFocus
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={info.email}
                readOnly
                className="w-full px-4 py-3 border border-gray-100 rounded-xl text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Придумай пароль</label>
              <input
                type="password"
                value={form.password}
                onChange={set("password")}
                placeholder="Минимум 6 символов"
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Подтверди пароль</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                placeholder="Повтори пароль"
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50 mt-2"
            >
              {loading ? "Создаём аккаунт..." : "Создать аккаунт"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-400 mt-4">
          Уже есть аккаунт?{" "}
          <a href="/agency/login" className="text-blue-600 hover:underline">
            Войти
          </a>
        </p>
      </div>
    </div>
  );
}

export default function AgencyJoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-9 h-9 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    }>
      <JoinForm />
    </Suspense>
  );
}
