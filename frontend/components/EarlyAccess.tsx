"use client";

import { useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { CheckCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { track } from "@/lib/analytics";

type UserType = "student" | "agency";

export function EarlyAccess() {
  const { t } = useTranslation("landing");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<UserType>("student");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg(t("early_access.email_invalid"));
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/early-access`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), type: userType }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setErrorMsg(t("early_access.email_exists"));
          setStatus("idle");
          return;
        }
        throw new Error(data?.detail ?? t("early_access.server_error"));
      }
      setStatus("success");
      track("early_access_submit", { user_type: userType });
    } catch {
      setStatus("error");
      setErrorMsg(t("early_access.generic_error"));
    }
  };

  return (
    <section id="early-access" ref={ref} className="py-24 lg:py-32 px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-[#6C63FF]/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#6C63FF]/8 rounded-full blur-[60px]" />
      </div>

      <div className="relative max-w-2xl mx-auto text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 bg-[#6C63FF]/10 border border-[#6C63FF]/30 text-[#9C8BFF] text-xs font-semibold px-4 py-2 rounded-full mb-8"
        >
          <span className="w-2 h-2 bg-[#6C63FF] rounded-full animate-pulse" />
          {t("early_access.badge")}
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F0F0FF] mb-4 tracking-tight"
        >
          {t("early_access.title")}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-[#8B8BA7] text-base sm:text-lg mb-3 leading-relaxed"
        >
          {t("early_access.subtitle_1")}{" "}
          <span className="text-[#F0F0FF] font-semibold">50%</span> {t("early_access.subtitle_2")}
          <br />
          {t("early_access.subtitle_3")}
        </motion.p>


        {/* Form */}
        <AnimatePresence mode="wait">
          {status === "success" ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#13131A] border border-[#00D4AA]/30 rounded-2xl p-8 flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/20 flex items-center justify-center">
                <CheckCircle size={32} className="text-[#00D4AA]" />
              </div>
              <h3 className="text-[#F0F0FF] font-bold text-xl">
                {t("early_access.success_title")}
              </h3>
              <p className="text-[#8B8BA7] text-sm">
                {t("early_access.success_desc")}
              </p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
              onSubmit={handleSubmit}
              className="bg-[#13131A] border border-[#1E1E2E] rounded-2xl p-6 sm:p-8"
            >
              {/* User type toggle */}
              <div className="flex bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl p-1 mb-5">
                {(["student", "agency"] as UserType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setUserType(type)}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                      userType === type
                        ? "bg-[#6C63FF] text-white shadow-sm"
                        : "text-[#8B8BA7] hover:text-[#F0F0FF]"
                    }`}
                  >
                    {type === "student" ? t("early_access.user_type_student") : t("early_access.user_type_agency")}
                  </button>
                ))}
              </div>

              {/* Email input */}
              <div className="mb-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  placeholder={t("early_access.email_placeholder")}
                  required
                  className="w-full bg-[#0A0A0F] border border-[#1E1E2E] focus:border-[#6C63FF]/50 text-[#F0F0FF] placeholder-[#8B8BA7]/50 rounded-xl px-4 py-3.5 text-sm outline-none transition-colors duration-200"
                />
                {errorMsg && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[#FF6B6B] text-xs mt-2 text-left"
                  >
                    {errorMsg}
                  </motion.p>
                )}
              </div>

              {/* Submit button */}
              <motion.button
                type="submit"
                disabled={status === "loading"}
                whileHover={status !== "loading" ? { scale: 1.02 } : {}}
                whileTap={status !== "loading" ? { scale: 0.97 } : {}}
                className="w-full bg-gradient-to-r from-[#6C63FF] to-[#9C8BFF] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#6C63FF]/25 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 text-sm"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t("early_access.sending")}
                  </>
                ) : (
                  t("early_access.submit")
                )}
              </motion.button>

              {status === "error" && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[#FF6B6B] text-xs mt-3 text-center"
                >
                  {errorMsg}
                </motion.p>
              )}

              <p className="text-[#8B8BA7]/60 text-xs mt-4">
                {t("early_access.no_spam")}
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
