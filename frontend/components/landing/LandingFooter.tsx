"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

export function LandingFooter() {
  const { t } = useTranslation("landing");

  return (
    <footer className="px-4 pb-12 sm:px-6">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-start justify-between gap-6 border-t border-[#DCDDF0] pt-8 text-[15px] text-[#4A5578]">
        <div className="max-w-[520px]">
          <p className="mb-2 font-semibold text-[#1E1B4B]">Vizora AI</p>
          <p className="mb-2">{t("showcase.footer.tagline")}</p>
          <p className="text-[13px] text-[#6B7393]">{t("showcase.footer.disclaimer")}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-1">
          <Link href="/blog" className="py-3 hover:text-[#4C46D8]">
            {t("showcase.nav.blog")}
          </Link>
          <Link href="/agency/login" className="py-3 hover:text-[#4C46D8]">
            {t("showcase.nav.agencies")}
          </Link>
          <Link href="/privacy" className="py-3 hover:text-[#4C46D8]">
            {t("showcase.footer.privacy")}
          </Link>
          <Link href="/terms" className="py-3 hover:text-[#4C46D8]">
            {t("showcase.footer.terms")}
          </Link>
          <a href="https://instagram.com/vizora_ai" target="_blank" rel="noopener noreferrer" className="py-3 hover:text-[#4C46D8]">
            Instagram
          </a>
        </nav>
      </div>
    </footer>
  );
}
