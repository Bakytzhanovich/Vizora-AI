"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, GraduationCap, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AxiosError } from "axios";
import { VizoraMark } from "@/components/VizoraMark";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { OfficialSeal } from "@/components/OfficialSeal";
import { apiGetSocialProof } from "@/lib/api";

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slowLoading, setSlowLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [studentCount, setStudentCount] = useState<number | null>(null);

  useEffect(() => {
    apiGetSocialProof()
      .then((data) => setStudentCount(data.student_count))
      .catch(() => {});
  }, []);

  const redirectAfterAuth = (user: { role: string }, profile: unknown) => {
    if (user.role === "admin") {
      router.push("/admin/dashboard");
      return;
    }
    router.push(profile ? "/dashboard" : "/onboarding");
  };

  const handleGoogleSuccess = async (idToken: string) => {
    setErrors({});
    try {
      const { user, profile } = await loginWithGoogle(idToken);
      redirectAfterAuth(user, profile);
    } catch {
      setErrors({ general: "Не удалось войти через Google. Попробуй снова." });
    }
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!email.trim()) e.email = "Заполните это поле";
    if (!password) e.password = "Заполните это поле";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    const slowTimer = setTimeout(() => setSlowLoading(true), 2500);
    try {
      let result;
      try {
        result = await login(email, password);
      } catch (err) {
        const axErr = err as AxiosError<{ detail: string }>;
        // A free-tier Render instance that just woke from sleep can drop or
        // 5xx the very first request — retry once silently before showing
        // anything scary. A genuine wrong password is a stable 401 on every
        // attempt, so it's never retried here (also spares the login
        // endpoint's rate limit from a needless second call).
        if (axErr.response?.status === 401) throw err;
        result = await login(email, password);
      }
      redirectAfterAuth(result.user, result.profile);
    } catch (err) {
      const axErr = err as AxiosError<{ detail: string }>;
      if (axErr.response?.status === 401) {
        setErrors({ general: "Неверный email или пароль" });
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
            <OfficialSeal className="w-6 h-6 ml-0.5" />
          </Link>
          <h1 className="text-2xl font-bold text-primary mb-2">Добро пожаловать</h1>
          <p className="text-secondary text-sm mb-3">Войди в свой аккаунт</p>
          {studentCount !== null && studentCount > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-1.5 text-xs text-secondary bg-card border border-border rounded-full px-3 py-1.5"
            >
              <GraduationCap size={14} className="text-accent" />
              <span>{studentCount}+ студентов готовятся к интервью в США</span>
            </motion.div>
          )}
        </div>

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
            <div>
              <label className="block text-secondary text-xs font-semibold uppercase tracking-wide mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
                placeholder="student@example.com"
                className={`w-full bg-bg border rounded-xl px-4 py-3.5 text-sm text-primary placeholder-secondary/40 outline-none transition-colors duration-200 ${errors.email ? "border-error/60" : "border-border focus:border-accent/50"}`}
                autoComplete="email"
              />
              {errors.email && <p className="text-error text-xs mt-1.5">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-secondary text-xs font-semibold uppercase tracking-wide mb-2">
                Пароль
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
                  placeholder="Твой пароль"
                  className={`w-full bg-bg border rounded-xl px-4 py-3.5 pr-11 text-sm text-primary placeholder-secondary/40 outline-none transition-colors duration-200 ${errors.password ? "border-error/60" : "border-border focus:border-accent/50"}`}
                  autoComplete="current-password"
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

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={!loading ? { scale: 1.02 } : {}}
              whileTap={!loading ? { scale: 0.97 } : {}}
              className="w-full bg-gradient-to-r from-accent to-accent-light text-white font-bold py-4 rounded-xl shadow-lg shadow-accent/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm transition-all duration-200 mt-2"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Входим...</>
              ) : (
                "Войти →"
              )}
            </motion.button>

            {slowLoading && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-secondary text-xs text-center"
              >
                Сервер просыпается после простоя — это может занять до минуты.
              </motion.p>
            )}
          </form>

          <GoogleAuthButton onSuccess={handleGoogleSuccess} />
        </div>

        <p className="text-center text-secondary text-sm mt-6">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-accent hover:text-accent-light font-semibold transition-colors">
            Зарегистрироваться
          </Link>
        </p>

        <div className="text-center mt-4">
          <Link
            href="/agency/login"
            className="inline-flex items-center gap-1.5 text-xs text-secondary/60 hover:text-secondary transition-colors border border-border rounded-lg px-3 py-1.5"
          >
            <Building2 size={13} />
            Войти как агентство
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
