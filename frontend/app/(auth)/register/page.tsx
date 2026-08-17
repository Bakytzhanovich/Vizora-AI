"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AxiosError } from "axios";
import { ReferralBanner } from "@/components/referral/ReferralBanner";
import { track } from "@/lib/analytics";
import { VizoraMark } from "@/components/VizoraMark";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";

interface FormErrors {
  email?: string;
  password?: string;
  confirm?: string;
  general?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { register, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slowLoading, setSlowLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [refCode, setRefCode] = useState<string | null>(null);
  const [refName, setRefName] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("ref");
    if (code) {
      setRefCode(code.toUpperCase());
      // Try to fetch referrer name
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      fetch(`${BASE}/api/referral/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer preview" },
        body: JSON.stringify({ referral_code: code }),
      })
        .then((r) => r.json())
        .then((d) => { if (d.referrer_name) setRefName(d.referrer_name); })
        .catch(() => {});
    }
  }, []);

  const handleGoogleSuccess = async (idToken: string) => {
    setErrors({});
    try {
      track("register_start", { has_referral: !!refCode, method: "google" });
      const { user, profile } = await loginWithGoogle(idToken);
      track("register_complete", { has_referral: !!refCode, method: "google" });
      if (user.role === "admin") {
        router.push("/admin/dashboard");
        return;
      }
      router.push(profile ? "/dashboard" : "/onboarding");
    } catch {
      setErrors({ general: "Не удалось войти через Google. Попробуй снова." });
    }
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!email.trim()) e.email = "Заполните это поле";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Некорректный email";
    if (!password) e.password = "Заполните это поле";
    else if (password.length < 8) e.password = "Пароль должен содержать минимум 8 символов";
    if (!confirm) e.confirm = "Заполните это поле";
    else if (password !== confirm) e.confirm = "Пароли не совпадают";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    const slowTimer = setTimeout(() => setSlowLoading(true), 4000);
    try {
      track("register_start", { has_referral: !!refCode });
      await register(email, password, refCode ?? undefined);
      track("register_complete", { has_referral: !!refCode });
      router.push("/onboarding");
    } catch (err) {
      const axErr = err as AxiosError<{ detail: string }>;
      if (axErr.response?.status === 409) {
        setErrors({ email: "Email уже используется" });
      } else {
        setErrors({ general: "Что-то пошло не так. Попробуй снова." });
      }
    } finally {
      clearTimeout(slowTimer);
      setSlowLoading(false);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <VizoraMark className="h-9 w-9" priority />
            <span className="text-primary font-bold text-xl">
              Vizora <span className="text-accent">AI</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-primary mb-2">Создай аккаунт</h1>
          <p className="text-secondary text-sm">
            Начни подготовку к интервью прямо сейчас
          </p>
        </div>

        {refName && <ReferralBanner referrerName={refName} />}

        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8">
          {errors.general && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 bg-error/10 border border-error/20 text-error text-sm rounded-xl px-4 py-3"
            >
              {errors.general}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-secondary text-xs font-semibold uppercase tracking-wide mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
                placeholder="student@example.com"
                className={`w-full bg-bg border rounded-xl px-4 py-3.5 text-sm text-primary placeholder-secondary/40 outline-none transition-colors duration-200 ${errors.email ? "border-error/60 focus:border-error" : "border-border focus:border-accent/50"}`}
                autoComplete="email"
              />
              {errors.email && <p className="text-error text-xs mt-1.5">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-secondary text-xs font-semibold uppercase tracking-wide mb-2">
                Пароль
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
                  placeholder="Минимум 8 символов"
                  className={`w-full bg-bg border rounded-xl px-4 py-3.5 pr-11 text-sm text-primary placeholder-secondary/40 outline-none transition-colors duration-200 ${errors.password ? "border-error/60 focus:border-error" : "border-border focus:border-accent/50"}`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-error text-xs mt-1.5">{errors.password}</p>}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-secondary text-xs font-semibold uppercase tracking-wide mb-2">
                Повтори пароль
              </label>
              <input
                type={showPass ? "text" : "password"}
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined })); }}
                placeholder="Повтори пароль"
                className={`w-full bg-bg border rounded-xl px-4 py-3.5 text-sm text-primary placeholder-secondary/40 outline-none transition-colors duration-200 ${errors.confirm ? "border-error/60 focus:border-error" : "border-border focus:border-accent/50"}`}
                autoComplete="new-password"
              />
              {errors.confirm && <p className="text-error text-xs mt-1.5">{errors.confirm}</p>}
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={!loading ? { scale: 1.02 } : {}}
              whileTap={!loading ? { scale: 0.97 } : {}}
              className="w-full bg-gradient-to-r from-accent to-accent-light text-white font-bold py-4 rounded-xl shadow-lg shadow-accent/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm transition-all duration-200 mt-2"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Создаём аккаунт...</>
              ) : (
                "Зарегистрироваться →"
              )}
            </motion.button>

            {slowLoading && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-secondary text-xs text-center"
              >
                Сервер просыпается после простоя — это может занять до минуты. Спасибо за терпение 🙏
              </motion.p>
            )}
          </form>

          <GoogleAuthButton onSuccess={handleGoogleSuccess} />
        </div>

        <p className="text-center text-secondary text-sm mt-6">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-accent hover:text-accent-light font-semibold transition-colors">
            Войти
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
