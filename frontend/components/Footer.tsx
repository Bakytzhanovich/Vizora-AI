"use client";

import { motion } from "framer-motion";
import { VizoraMark } from "@/components/VizoraMark";

type FooterLink = { label: string; href: string; external?: boolean };

const footerLinks: Record<string, FooterLink[]> = {
  Студентам: [
    { label: "AI FAQ помощник", href: "#students" },
    { label: "Симулятор интервью", href: "#solution" },
    { label: "Документы", href: "#solution" },
    { label: "Roadmap", href: "#how-it-works" },
  ],
  Агентствам: [
    { label: "Возможности", href: "#agencies" },
    { label: "Тарифы", href: "#agencies" },
    { label: "White-label", href: "#agencies" },
    { label: "Подключить", href: "#early-access" },
  ],
  Контакты: [
    { label: "Telegram", href: "https://t.me/vizora_ai", external: true },
    { label: "Instagram", href: "https://instagram.com/vizora_ai", external: true },
    { label: "Email", href: "mailto:hello@vizora.ai", external: true },
  ],
};

export function Footer() {
  const handleNavClick = (href: string, external?: boolean) => {
    if (external) return;
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer className="border-t border-[#1E1E2E] pt-16 pb-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <VizoraMark className="h-8 w-8" />
              <span className="text-[#F0F0FF] font-bold text-lg tracking-tight">
                Vizora <span className="text-[#6C63FF]">AI</span>
              </span>
            </div>
            <p className="text-[#8B8BA7] text-sm leading-relaxed mb-6">
              Vizora AI — твой путь к визе
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3">
              <motion.a
                href="https://t.me/vizora_ai"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-9 h-9 rounded-xl bg-[#13131A] border border-[#1E1E2E] hover:border-[#6C63FF]/40 flex items-center justify-center text-[#8B8BA7] hover:text-[#F0F0FF] transition-all duration-200"
                aria-label="Telegram"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.024 9.538c-.143.678-.529.843-.993.525l-2.837-2.091-1.37 1.317c-.152.151-.278.278-.569.278l.202-2.875 5.23-4.724c.228-.201-.049-.314-.353-.113L7.403 14.64l-2.775-.869c-.604-.189-.615-.604.126-.895l10.844-4.182c.504-.182.944.112.964.554z" />
                </svg>
              </motion.a>
              <motion.a
                href="https://instagram.com/vizora_ai"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-9 h-9 rounded-xl bg-[#13131A] border border-[#1E1E2E] hover:border-[#6C63FF]/40 flex items-center justify-center text-[#8B8BA7] hover:text-[#F0F0FF] transition-all duration-200"
                aria-label="Instagram"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </motion.a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-[#F0F0FF] font-semibold text-sm mb-4">{category}</h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#8B8BA7] hover:text-[#F0F0FF] text-sm transition-colors duration-200"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <button
                        onClick={() => handleNavClick(link.href)}
                        className="text-[#8B8BA7] hover:text-[#F0F0FF] text-sm transition-colors duration-200 text-left"
                      >
                        {link.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-[#1E1E2E] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[#8B8BA7]/60 text-sm">
            © 2026 Vizora AI. Все права защищены.
          </p>
          <div className="flex items-center gap-4 text-[#8B8BA7]/60 text-xs">
            <span>Политика конфиденциальности</span>
            <span>·</span>
            <span>Условия использования</span>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-6 bg-[#13131A] border border-[#1E1E2E] rounded-xl px-4 py-3">
          <p className="text-[#8B8BA7]/50 text-xs text-center leading-relaxed">
            Vizora AI предоставляет рекомендации для подготовки к интервью, а не юридический совет.
            Решение о выдаче визы принимает консульский офицер США.
          </p>
        </div>
      </div>
    </footer>
  );
}
