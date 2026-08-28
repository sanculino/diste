import { localePath, type Locale } from "./config";
import type { Dictionary } from "./get-dictionary";

export type NavLink = { href: string; label: string };

/** Build locale-aware navigation links from a dictionary. */
export function buildNavLinks(locale: Locale, dict: Dictionary): NavLink[] {
  const n = dict.nav;
  return [
    { href: `${localePath(locale, "/")}#chi-siamo`, label: n.chiSiamo },
    { href: `${localePath(locale, "/")}#mission`, label: n.mission },
    { href: `${localePath(locale, "/")}#servizi`, label: n.servizi },
    { href: `${localePath(locale, "/")}#software`, label: n.software },
    { href: `${localePath(locale, "/")}#progetti`, label: n.progetti },
    { href: localePath(locale, "/pm-web-agent"), label: n.pmwa },
    { href: `${localePath(locale, "/")}#clienti`, label: n.clienti },
    { href: `${localePath(locale, "/")}#partner`, label: n.partner },
    { href: `${localePath(locale, "/")}#contatti`, label: n.contatti },
  ];
}
