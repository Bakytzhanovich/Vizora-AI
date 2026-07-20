"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { VizoraMark } from "@/components/VizoraMark";

const navLinks = [
  { href: "#students", label: "Студентам" },
  { href: "#agencies", label: "Агентствам" },
  { href: "#how-it-works", label: "Как работает" },
];

export function Navbar() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-[#1E1E2E]"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <motion.a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="flex items-center gap-2 group"
              whileHover={{ scale: 1.02 }}
            >
              <VizoraMark className="h-8 w-8" priority />
              <span className="text-[#F0F0FF] font-bold text-lg tracking-tight">
                Vizora{" "}
                <span className="text-[#6C63FF]">AI</span>
              </span>
            </motion.a>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href)}
                  className="text-[#8B8BA7] hover:text-[#F0F0FF] text-sm font-medium transition-colors duration-200"
                >
                  {link.label}
                </button>
              ))}
            </div>

            {/* CTA */}
            <div className="hidden md:flex items-center gap-3">
              <motion.button
                onClick={() => router.push("/login")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="text-[#8B8BA7] hover:text-[#F0F0FF] text-sm font-medium px-4 py-2 rounded-xl transition-colors duration-200"
              >
                Войти
              </motion.button>
              <motion.button
                onClick={() => router.push("/register")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-[#6C63FF] hover:bg-[#7C75FF] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-[#6C63FF]/20"
              >
                Регистрация
              </motion.button>
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden text-[#8B8BA7] hover:text-[#F0F0FF] transition-colors"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Меню"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed top-16 left-0 right-0 z-40 bg-[#13131A] border-b border-[#1E1E2E] md:hidden"
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href)}
                  className="text-[#8B8BA7] hover:text-[#F0F0FF] text-base font-medium py-3 text-left transition-colors border-b border-[#1E1E2E] last:border-0"
                >
                  {link.label}
                </button>
              ))}
              <button
                onClick={() => { setMobileOpen(false); router.push("/login"); }}
                className="mt-2 w-full border border-[#1E1E2E] text-[#F0F0FF] text-sm font-semibold py-3 rounded-xl"
              >
                Войти
              </button>
              <button
                onClick={() => { setMobileOpen(false); router.push("/register"); }}
                className="mt-2 w-full bg-[#6C63FF] text-white text-sm font-semibold py-3 rounded-xl"
              >
                Регистрация
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
