"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { navLinks, navLinksEn } from "@/content/site";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "/";
  const isEn = pathname === "/en" || pathname.startsWith("/en/");
  const locale: Locale = isEn ? "en" : "it";
  const homeHref = isEn ? "/en" : "/";
  const links = isEn ? navLinksEn : navLinks;
  const contactLabel = isEn ? "Contact us" : "Contattaci";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        scrolled
          ? "border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md"
          : "border-transparent bg-white/70 backdrop-blur"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href={homeHref} className="flex shrink-0 items-center">
          <BrandLogo variant="header" priority />
        </Link>

        <nav className="hidden items-center gap-1 text-sm font-medium text-slate-700 lg:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-diste-blue"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher
            locale={locale}
            switchLabel={isEn ? "Italiano" : "English"}
          />
          <a
            href={isEn ? "/en#contatti" : "/#contatti"}
            className="hidden rounded-full bg-gradient-to-r from-diste-blue via-diste-azure to-diste-green px-4 py-2 text-sm font-semibold text-white shadow-md shadow-diste-blue/20 transition hover:brightness-110 sm:inline-flex"
          >
            {contactLabel}
          </a>
          <button
            type="button"
            aria-label="Apri menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 lg:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">Menu</span>
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden
            >
              {open ? (
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <a
              href={isEn ? "/en#contatti" : "/#contatti"}
              className="mt-2 rounded-full bg-gradient-to-r from-diste-blue via-diste-azure to-diste-green px-4 py-3 text-center text-sm font-semibold text-white"
              onClick={() => setOpen(false)}
            >
              {contactLabel}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
