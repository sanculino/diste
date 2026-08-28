"use client";

import { BrandLogo } from "@/components/ui/BrandLogo";
import { localeFromPathname, type Locale } from "@/i18n/config";
import { buildNavLinks } from "@/i18n/nav";
import { dictionary as itDict } from "@/i18n/dictionaries/it";
import { dictionary as enDict } from "@/i18n/dictionaries/en";
import { usePathname } from "next/navigation";

function dictForLocale(locale: Locale) {
  return locale === "en" ? enDict : itDict;
}

export function Footer() {
  const pathname = usePathname() || "/";
  const locale = localeFromPathname(pathname);
  const dict = dictForLocale(locale);
  const { footer } = dict.site;
  const links = buildNavLinks(locale, dict);
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <BrandLogo variant="footer" />
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">{footer.tagline}</p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-white">
              {footer.navigation}
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {links.map((l) => (
                <li key={l.href}>
                  <a className="hover:text-white" href={l.href}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-white">
              {footer.quickContact}
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a className="hover:text-white" href="tel:+390915751728">
                  +39 091 5751728
                </a>
              </li>
              <li>
                <a className="hover:text-white" href="mailto:info@distemanagement.com">
                  info@distemanagement.com
                </a>
              </li>
              <li>
                <a
                  className="hover:text-white"
                  href="https://www.distemanagement.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  www.distemanagement.com
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-slate-800 pt-8 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>
            © {year} DI.S.TE. MANAGEMENT S.a.s. — {footer.copyright}
          </p>
          <div className="flex flex-wrap gap-4">
            <span className="text-slate-500">{footer.privacyNote}</span>
            <span className="hidden sm:inline">·</span>
            <span>{footer.vatNote}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
