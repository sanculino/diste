import { describe, expect, it } from "vitest";
import {
  buildNavLinks,
} from "@/i18n/nav";
import {
  defaultLocale,
  localeFromPathname,
  localePath,
  stripLocalePrefix,
  switchLocalePath,
} from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { dictionary as itDict } from "@/i18n/dictionaries/it";
import { dictionary as enDict } from "@/i18n/dictionaries/en";

describe("locale routing", () => {
  it("detects locale from pathname", () => {
    expect(localeFromPathname("/")).toBe("it");
    expect(localeFromPathname("/pm-web-agent")).toBe("it");
    expect(localeFromPathname("/en")).toBe("en");
    expect(localeFromPathname("/en/pm-web-agent")).toBe("en");
  });

  it("strips /en prefix for locale-neutral paths", () => {
    expect(stripLocalePrefix("/en")).toBe("/");
    expect(stripLocalePrefix("/en/pm-web-agent")).toBe("/pm-web-agent");
    expect(stripLocalePrefix("/pm-web-agent")).toBe("/pm-web-agent");
  });

  it("builds locale paths", () => {
    expect(localePath("it", "/")).toBe("/");
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("en", "/pm-web-agent")).toBe("/en/pm-web-agent");
    expect(localePath("it", "/pm-web-agent")).toBe("/pm-web-agent");
  });

  it("switches IT → EN preserving equivalent page", () => {
    expect(switchLocalePath("it", "/")).toBe("/en");
    expect(switchLocalePath("it", "/pm-web-agent")).toBe("/en/pm-web-agent");
    expect(switchLocalePath("it", "/pm-web-agent/come-funziona")).toBe(
      "/en/pm-web-agent/how-it-works",
    );
    expect(switchLocalePath("it", "/pm-web-agent/rinnova")).toBe("/en/pm-web-agent/renew");
    expect(switchLocalePath("it", "/purchase/success")).toBe("/en/purchase/success");
  });

  it("switches EN → IT without getting stuck on /en", () => {
    expect(switchLocalePath("en", "/en")).toBe("/");
    expect(switchLocalePath("en", "/en/pm-web-agent")).toBe("/pm-web-agent");
    expect(switchLocalePath("en", "/en/pm-web-agent/how-it-works")).toBe(
      "/pm-web-agent/come-funziona",
    );
    expect(switchLocalePath("en", "/en/pm-web-agent/renew")).toBe("/pm-web-agent/rinnova");
    expect(switchLocalePath("en", "/en/purchase/success")).toBe("/purchase/success");
  });

  it("does not create double /en/en paths", () => {
    const targets = [
      switchLocalePath("it", "/"),
      switchLocalePath("it", "/pm-web-agent"),
      switchLocalePath("en", "/en/pm-web-agent"),
    ];
    for (const href of targets) {
      expect(href).not.toMatch(/\/en\/en/);
    }
  });

  it("round-trip IT → EN → IT returns to same page", () => {
    const paths = ["/", "/pm-web-agent", "/pm-web-agent/come-funziona", "/purchase/success"];
    for (const path of paths) {
      const en = switchLocalePath("it", path);
      expect(localeFromPathname(en)).toBe("en");
      const back = switchLocalePath("en", en);
      expect(back).toBe(path);
    }
  });
});

describe("dictionaries", () => {
  it("Italian homepage content is Italian", async () => {
    const dict = await getDictionary("it");
    expect(dict.site.hero.ctaPrimary).toMatch(/Richiedi/i);
    expect(dict.site.chiSiamo.title).toBe("Chi siamo");
    expect(dict.nav.contactCta).toBe("Contattaci");
  });

  it("English homepage content is English", async () => {
    const dict = await getDictionary("en");
    expect(dict.site.hero.ctaPrimary).toMatch(/Request/i);
    expect(dict.site.chiSiamo.title).toBe("About us");
    expect(dict.nav.contactCta).toBe("Contact us");
  });

  it("PM Web Agent IT billing strings are Italian", async () => {
    const dict = await getDictionary("it");
    expect(dict.pmwa.billing.submit).toMatch(/Salva/i);
    expect(dict.pmwa.errors.email).toMatch(/non valida/i);
  });

  it("PM Web Agent EN billing strings are English", async () => {
    const dict = await getDictionary("en");
    expect(dict.pmwa.billing.submit).toMatch(/Save/i);
    expect(dict.pmwa.errors.email).toMatch(/Invalid/i);
  });

  it("internal nav links preserve locale prefix", () => {
    const itLinks = buildNavLinks("it", itDict);
    const enLinks = buildNavLinks("en", enDict);
    expect(itLinks.every((l) => !l.href.startsWith("/en"))).toBe(true);
    expect(enLinks.every((l) => l.href.startsWith("/en") || l.href.includes("/en/"))).toBe(true);
    expect(itLinks.find((l) => l.label === "PM Web Agent")?.href).toBe("/pm-web-agent");
    expect(enLinks.find((l) => l.label === "PM Web Agent")?.href).toBe("/en/pm-web-agent");
  });

  it("default locale is Italian", () => {
    expect(defaultLocale).toBe("it");
  });
});

describe("hard-coded public UI scan", () => {
  const italianUiMarkers = [
    "Richiedi una consulenza",
    "Si sono affidati a noi",
    "Contattaci",
    "Tutti i diritti riservati",
  ];

  it("English site dictionary has no unintended Italian homepage markers", () => {
    const blob = JSON.stringify(enDict.site);
    for (const marker of italianUiMarkers) {
      expect(blob).not.toContain(marker);
    }
  });

  it("Italian site dictionary has no unintended English homepage CTAs", () => {
    const blob = JSON.stringify(itDict.site);
    expect(blob).not.toContain("Request a consultation");
    expect(blob).not.toContain("About us");
  });
});
