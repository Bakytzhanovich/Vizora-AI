"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { VizoraMark } from "@/components/VizoraMark";

type FooterLink = { label: string; href: string; external?: boolean };

// TODO: Telegram link removed — t.me/vizora_ai resolves to an unrelated
// third-party channel, not ours. Restore once the real channel exists.
const studentsHrefs = ["#students", "#solution", "#solution", "#how-it-works", "/blog"];
const agenciesHrefs = ["#agencies", "#agencies", "#agencies", "#early-access"];
const contactLinks: FooterLink[] = [
  { label: "Instagram", href: "https://instagram.com/vizora_ai", external: true },
  { label: "Email", href: "mailto:hello@vizora.ai", external: true },
];

export function Footer() {
  const router = useRouter();
  const { t } = useTranslation("landing");

  const studentsLabels = t("footer.students_links", { returnObjects: true }) as string[];
  const agenciesLabels = t("footer.agencies_links", { returnObjects: true }) as string[];

  const footerLinks: Record<string, FooterLink[]> = {
    [t("footer.students_col")]: studentsLabels.map((label, i) => ({ label, href: studentsHrefs[i] })),
    [t("footer.agencies_col")]: agenciesLabels.map((label, i) => ({ label, href: agenciesHrefs[i] })),
    [t("footer.contacts_col")]: contactLinks,
  };

  const handleNavClick = (href: string, external?: boolean) => {
    if (external) return;
    // These ids only exist on the homepage — from /blog, /privacy, /terms
    // etc. querySelector finds nothing and scrollIntoView silently no-ops,
    // so fall back to navigating to the homepage with the hash.
    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      router.push(`/${href}`);
    }
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
              {t("footer.tagline")}
            </p>
            {/* Social links */}
            {/* TODO: Telegram icon removed — t.me/vizora_ai resolves to an
                unrelated third-party channel, not ours. Restore once the
                real channel exists. */}
            <div className="flex items-center gap-3">
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
                    ) : link.href.startsWith("/") ? (
                      <Link
                        href={link.href}
                        className="text-[#8B8BA7] hover:text-[#F0F0FF] text-sm transition-colors duration-200"
                      >
                        {link.label}
                      </Link>
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
          <p className="text-[#8B8BA7] text-sm">
            {t("footer.copyright")}
          </p>
          <div className="flex items-center gap-4 text-[#8B8BA7] text-xs">
            <Link href="/privacy" className="hover:text-[#F0F0FF] transition-colors duration-200">
              {t("footer.privacy")}
            </Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-[#F0F0FF] transition-colors duration-200">
              {t("footer.terms")}
            </Link>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-6 bg-[#13131A] border border-[#1E1E2E] rounded-xl px-4 py-3">
          <p className="text-[#8B8BA7] text-xs text-center leading-relaxed">
            {t("footer.disclaimer")}
          </p>
        </div>
      </div>
    </footer>
  );
}
