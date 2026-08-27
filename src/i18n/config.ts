export const locales = ["it", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "it";

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

/** Italian pages live at root (/); English at /en/... */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === "it") return clean === "/" ? "/" : clean;
  return clean === "/" ? "/en" : `/en${clean}`;
}

/** IT ↔ EN paths that differ beyond the /en prefix */
const LOCALE_PATH_PAIRS: ReadonlyArray<readonly [it: string, en: string]> = [
  ["/pm-web-agent/come-funziona", "/en/pm-web-agent/how-it-works"],
];

function mapLocalePath(path: string, toEn: boolean): string {
  for (const [itPath, enPath] of LOCALE_PATH_PAIRS) {
    if (toEn && path === itPath) return enPath;
    if (!toEn && path === enPath) return itPath;
  }
  return path;
}

export function switchLocalePath(currentLocale: Locale, pathname: string): string {
  const enPrefix = "/en";
  const isEn = pathname === enPrefix || pathname.startsWith(`${enPrefix}/`);
  const base = isEn
    ? pathname === enPrefix
      ? "/"
      : pathname.slice(enPrefix.length) || "/"
    : pathname;

  const target = currentLocale === "it" ? "en" : "it";
  if (target === "en") {
    const mapped = mapLocalePath(base, true);
    return mapped === "/" ? "/en" : mapped.startsWith("/en") ? mapped : `/en${mapped}`;
  }
  return mapLocalePath(pathname, false);
}
