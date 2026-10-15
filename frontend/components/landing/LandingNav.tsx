"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { VizoraMark } from "@/components/VizoraMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function LandingNav() {
  const { t } = useTranslation("landing");
  const [open, setOpen] = useState(false);

  // Absolute "/#..." so the same nav works on /blog and the legal pages too.
  const links = [
    { href: "/#how-it-works", label: t("showcase.nav.features") },
    { href: "/#agencies", label: t("showcase.nav.agencies") },
    { href: "/#pricing", label: t("showcase.nav.pricing") },
    { href: "/blog", label: t("showcase.nav.blog") },
  ];

  return (
    <header className="px-4 sm:px-6">
      <nav className="mx-auto flex min-h-[76px] max-w-[1200px] items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 text-[#1E1B4B]">
          <VizoraMark className="h-10 w-10" priority />
          <span className="text-xl font-extrabold">Vizora</span>
        </Link>

        <div className="hidden items-center gap-7 text-base font-semibold text-[#1E1B4B] lg:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="py-3 hover:text-[#4C46D8]">
              {link.label}
            </a>
          ))}
          <LanguageSwitcher variant="light" />
          <Link href="/login" className="py-3 hover:text-[#4C46D8]">
            {t("showcase.nav.login")}
          </Link>
          <Link href="/register" className="rounded-[14px] bg-[#4C46D8] px-5 py-3 text-white hover:bg-[#3F39C4]">
            {t("showcase.nav.start")}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="landing-mobile-menu"
          aria-label={open ? t("showcase.nav.menu_close") : t("showcase.nav.menu_open")}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-[#1E1B4B] lg:hidden"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {open && (
        <div id="landing-mobile-menu" className="mx-auto mb-4 flex max-w-[1200px] flex-col gap-1 rounded-3xl bg-white p-4 text-base font-semibold text-[#1E1B4B] lg:hidden">
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 hover:bg-[#F5F5FF]">
              {link.label}
            </a>
          ))}
          <Link href="/login" className="rounded-xl px-3 py-3 hover:bg-[#F5F5FF]">
            {t("showcase.nav.login")}
          </Link>
          <div className="flex items-center justify-between gap-3 px-3 pt-2">
            <LanguageSwitcher variant="light" />
            <Link href="/register" className="rounded-[14px] bg-[#4C46D8] px-5 py-3 text-white">
              {t("showcase.nav.start")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
