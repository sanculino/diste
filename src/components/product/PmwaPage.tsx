import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PurchasePmwa } from "@/components/product/PurchasePmwa";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

type Props = {
  locale: Locale;
};

export async function generatePmwaMetadata(locale: Locale): Promise<Metadata> {
  const dict = await getDictionary(locale);
  const base = "https://distemanagementsoftware.it";
  const path = locale === "en" ? "/en/pm-web-agent" : "/pm-web-agent";
  return {
    title: dict.pmwa.metaTitle,
    description: dict.pmwa.metaDescription,
    alternates: {
      canonical: `${base}${path}`,
      languages: {
        it: `${base}/pm-web-agent`,
        en: `${base}/en/pm-web-agent`,
      },
    },
  };
}

export async function PmwaPage({ locale }: Props) {
  const dict = await getDictionary(locale);
  const p = dict.pmwa;
  const homeHref = locale === "en" ? "/en" : "/";
  const guideHref = locale === "en" ? "/en/pm-web-agent/how-it-works" : "/pm-web-agent/come-funziona";

  return (
    <>
      <Header />
      <main>
        <section className="border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-cyan-50/40">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-diste-azure">
                {p.heroTag}
              </p>
              <LanguageSwitcher locale={locale} switchLabel={dict.meta.switchTo} />
            </div>
            <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {p.heroTitle}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-600">{p.heroSubtitle}</p>
            <p className="mt-3 max-w-2xl text-sm text-slate-500">{p.heroNote}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#pricing"
                className="rounded-full bg-gradient-to-r from-diste-blue via-diste-azure to-diste-green px-5 py-2.5 text-sm font-semibold text-white shadow-md"
              >
                {p.ctaPricing}
              </a>
              <Link
                href={guideHref}
                className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700"
              >
                {p.ctaGuide}
              </Link>
              <Link
                href={homeHref}
                className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700"
              >
                {p.ctaBack}
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <PurchasePmwa locale={locale} dict={dict.pmwa} />
        </section>
      </main>
      <Footer />
    </>
  );
}
