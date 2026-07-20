"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AxiosError } from "axios";
import { VizoraMark } from "@/components/VizoraMark";

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

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
    try {
      const { user, profile } = await login(email, password);
      if (user.role === "admin") {
        router.push("/admin/dashboard");
        return;
      }
      router.push(profile ? "/dashboard" : "/onboarding");
    } catch (err) {
      const axErr = err as AxiosError<{ detail: string }>;
      if (axErr.response?.status === 401) {
        setErrors({ general: "Неверный email или пароль" });
      } else {
        setErrors({ general: "Что-то пошло не так. Попробуй снова." });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4 py-12">
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
            <span className="text-[#F0F0FF] font-bold text-xl">
              Vizora <span className="text-[#6C63FF]">AI</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-[#F0F0FF] mb-2">Добро пожаловать</h1>
          <p className="text-[#8B8BA7] text-sm">Войди в свой аккаунт</p>
        </div>

        <div className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-6 sm:p-8">
          {errors.general && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 bg-[#FF6B6B]/10 border border-[#FF6B6B]/20 text-[#FF6B6B] text-sm rounded-xl px-4 py-3"
            >
              {errors.general}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label className="block text-[#8B8BA7] text-xs font-semibold uppercase tracking-wide mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
                placeholder="student@example.com"
                className={`w-full bg-[#0A0A0F] border rounded-xl px-4 py-3.5 text-sm text-[#F0F0FF] placeholder-[#8B8BA7]/40 outline-none transition-colors duration-200 ${errors.email ? "border-[#FF6B6B]/60" : "border-[#1E1E2E] focus:border-[#6C63FF]/50"}`}
                autoComplete="email"
              />
              {errors.email && <p className="text-[#FF6B6B] text-xs mt-1.5">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-[#8B8BA7] text-xs font-semibold uppercase tracking-wide mb-2">
                Пароль
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
                  placeholder="Твой пароль"
                  className={`w-full bg-[#0A0A0F] border rounded-xl px-4 py-3.5 pr-11 text-sm text-[#F0F0FF] placeholder-[#8B8BA7]/40 outline-none transition-colors duration-200 ${errors.password ? "border-[#FF6B6B]/60" : "border-[#1E1E2E] focus:border-[#6C63FF]/50"}`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B8BA7] hover:text-[#F0F0FF] transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-[#FF6B6B] text-xs mt-1.5">{errors.password}</p>}
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={!loading ? { scale: 1.02 } : {}}
              whileTap={!loading ? { scale: 0.97 } : {}}
              className="w-full bg-gradient-to-r from-[#6C63FF] to-[#9C8BFF] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#6C63FF]/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm transition-all duration-200 mt-2"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Входим...</>
              ) : (
                "Войти →"
              )}
            </motion.button>
          </form>
        </div>

        <p className="text-center text-[#8B8BA7] text-sm mt-6">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-[#6C63FF] hover:text-[#9C8BFF] font-semibold transition-colors">
            Зарегистрироваться
          </Link>
        </p>

        <div className="text-center mt-4">
          <Link
            href="/agency/login"
            className="inline-flex items-center gap-1.5 text-xs text-[#8B8BA7]/60 hover:text-[#8B8BA7] transition-colors border border-[#1E1E2E] rounded-lg px-3 py-1.5"
          >
            <span>🏢</span>
            Войти как агентство
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
