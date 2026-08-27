import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { comeFunzionaPmwa } from "@/content/come-funziona-pmwa";
import type { Locale } from "@/i18n/config";

type Props = { locale: Locale };

export function guideMetadata(locale: Locale): Metadata {
  const base = "https://distemanagementsoftware.it";
  const isEn = locale === "en";
  return {
    title: isEn ? "PM Web Agent — How it works" : "PM Web Agent — Come funziona",
    description: comeFunzionaPmwa(locale).intro.slice(0, 160),
    alternates: {
      canonical: isEn
        ? `${base}/en/pm-web-agent/how-it-works`
        : `${base}/pm-web-agent/come-funziona`,
      languages: {
        it: `${base}/pm-web-agent/come-funziona`,
        en: `${base}/en/pm-web-agent/how-it-works`,
      },
    },
  };
}

export function GuidePage({ locale }: Props) {
  const content = comeFunzionaPmwa(locale);
  const buyHref = locale === "en" ? "/en/pm-web-agent" : "/pm-web-agent";
  const homeHref = locale === "en" ? "/en" : "/";

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-end">
          <LanguageSwitcher locale={locale} switchLabel={locale === "it" ? "English" : "Italiano"} />
        </div>
        <h1 className="text-3xl font-bold text-slate-900">{content.title}</h1>
        <p className="mt-4 text-slate-600">{content.intro}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {content.pills.map((pill) => (
            <span
              key={pill}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
            >
              {pill}
            </span>
          ))}
        </div>
        <div className="mt-10 space-y-10">
          {content.sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-xl font-semibold text-slate-900">{s.title}</h2>
              {s.paragraphs?.map((p) => (
                <p key={p} className="mt-3 text-slate-600">
                  {p}
                </p>
              ))}
              {s.bullets ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-600">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
              {s.after ? <p className="mt-3 text-slate-600">{s.after}</p> : null}
              {s.note ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {s.note}
                </p>
              ) : null}
            </section>
          ))}
        </div>
        {content.faq.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-xl font-semibold text-slate-900">FAQ</h2>
            <dl className="mt-4 space-y-4">
              {content.faq.map((f) => (
                <div key={f.q}>
                  <dt className="font-medium text-slate-900">{f.q}</dt>
                  <dd className="mt-1 text-sm text-slate-600">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href={buyHref}
            className="rounded-full bg-gradient-to-r from-diste-blue to-diste-green px-5 py-2.5 text-sm font-semibold text-white"
          >
            {locale === "en" ? "Buy / Pricing" : "Acquista / Prezzi"}
          </Link>
          <Link href={homeHref} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700">
            {locale === "en" ? "Back to website" : "Torna al sito"}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
