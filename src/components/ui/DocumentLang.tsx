"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { localeFromPathname } from "@/i18n/config";

/** Keep document lang in sync with URL locale (Next.js root layout is shared). */
export function DocumentLang() {
  const pathname = usePathname() || "/";
  useEffect(() => {
    document.documentElement.lang = localeFromPathname(pathname);
  }, [pathname]);
  return null;
}
