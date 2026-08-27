"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { localePath, switchLocalePath, type Locale } from "@/i18n/config";

type Props = {
  locale: Locale;
  switchLabel: string;
};

export function LanguageSwitcher({ locale, switchLabel }: Props) {
  const pathname = usePathname() || "/";
  const href = switchLocalePath(locale, pathname);

  return (
    <Link
      href={href}
      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-diste-azure hover:text-diste-blue"
      hrefLang={locale === "it" ? "en" : "it"}
    >
      {switchLabel}
    </Link>
  );
}

export function localeHref(locale: Locale, path: string) {
  return localePath(locale, path);
}
