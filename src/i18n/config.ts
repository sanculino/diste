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

/** Detect locale from a pathname (no cookies — URL is authoritative). */
export function localeFromPathname(pathname: string): Locale {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "it";
}

/** Strip /en prefix to get the locale-neutral path. */
export function stripLocalePrefix(pathname: string): string {
  if (pathname === "/en") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3) || "/";
  return pathname;
}

/** IT ↔ EN paths that differ beyond the /en prefix (locale-neutral paths). */
const LOCALE_PATH_PAIRS: ReadonlyArray<readonly [it: string, en: string]> = [
  ["/pm-web-agent/come-funziona", "/pm-web-agent/how-it-works"],
  ["/pm-web-agent/rinnova", "/pm-web-agent/renew"],
];

function mapLocalePath(basePath: string, toEn: boolean): string {
  for (const [itPath, enPath] of LOCALE_PATH_PAIRS) {
    if (toEn && basePath === itPath) return enPath;
    if (!toEn && basePath === enPath) return itPath;
  }
  return basePath;
}

/** Switch the current pathname to the equivalent page in the other locale. */
export function switchLocalePath(currentLocale: Locale, pathname: string): string {
  const base = stripLocalePrefix(pathname);
  const target: Locale = currentLocale === "it" ? "en" : "it";
  if (target === "en") {
    return localePath("en", mapLocalePath(base, true));
  }
  return mapLocalePath(base, false);
}
