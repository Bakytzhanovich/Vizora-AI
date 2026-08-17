"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

import { ModuleGrid } from "@/components/after-visa/ModuleGrid";
import { apiGetAfterVisaModules, type AfterVisaModulesResponse } from "@/lib/api";
import { PoweredByFooter } from "@/components/branding/PoweredByFooter";

interface ApiErrorShape {
  response?: { status?: number; data?: { detail?: { error?: string } } };
}

export default function AfterVisaPage() {
  const router = useRouter();
  const [data, setData] = useState<AfterVisaModulesResponse | null>(null);
  const [subscriptionLocked, setSubscriptionLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      router.replace("/login");
      return;
    }
    apiGetAfterVisaModules()
      .then(setData)
      .catch((err: unknown) => {
        const e = err as ApiErrorShape;
        if (e.response?.status === 403 && e.response?.data?.detail?.error === "subscription_required") {
          setSubscriptionLocked(true);
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-teal/30 border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  if (subscriptionLocked) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 text-center gap-4">
        <div className="text-5xl">🔒</div>
        <h2 className="text-primary font-bold text-xl">Раздел доступен по подписке</h2>
        <p className="text-secondary text-sm max-w-xs">
          Модуль «После визы» открыт на планах СТАНДАРТ и ПРЕМИУМ
        </p>
        <button
          onClick={() => router.push("/pricing")}
          className="px-6 py-3 rounded-xl bg-accent text-white text-sm font-semibold"
        >
          Перейти к тарифам
        </button>
      </div>
    );
  }

  if (data && !data.unlocked) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 text-center gap-4">
        <div className="text-5xl">🔒</div>
        <h2 className="text-primary font-bold text-xl">Раздел заблокирован</h2>
        <p className="text-secondary text-sm max-w-xs">
          Отметь шаг «Получение визы» в Roadmap, чтобы открыть этот раздел
        </p>
        <button
          onClick={() => router.push("/roadmap")}
          className="px-6 py-3 rounded-xl bg-accent text-white text-sm font-semibold"
        >
          Перейти в Roadmap
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <PoweredByFooter />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-primary font-bold leading-tight">После визы</h1>
            <p className="text-secondary text-xs">Подготовка к поездке и жизнь в США</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-6">
        {/* Celebration banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-teal/10 to-[#00B894]/5 border border-teal/20 rounded-2xl p-5 mb-6"
        >
          <div className="text-3xl mb-2">🎉</div>
          <h2 className="text-primary font-bold text-lg mb-1">Поздравляем с визой!</h2>
          <p className="text-secondary text-sm leading-relaxed">
            Теперь подготовимся к поездке и жизни в США. Изучи все разделы — они помогут
            в первые недели и на протяжении всей программы.
          </p>
        </motion.div>

        {/* Overall progress */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-2xl p-4 mb-6"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-primary text-sm font-semibold">Общий прогресс</span>
              <span className="text-teal text-sm font-bold">{data.overall_pct}%</span>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden mb-2">
              <motion.div
                className="h-full bg-teal rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${data.overall_pct}%` }}
                transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
              />
            </div>
            <p className="text-secondary text-xs">
              {data.overall_completed} из {data.overall_total} разделов изучено
            </p>
          </motion.div>
        )}

        {/* Module grid */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <h2 className="text-primary font-semibold text-sm mb-3">Все разделы</h2>
            <ModuleGrid modules={data.modules} />
          </motion.div>
        )}
      </div>
    </div>
  );
}
