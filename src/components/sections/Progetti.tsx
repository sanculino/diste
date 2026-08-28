import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { localePath, type Locale } from "@/i18n/config";
import type { SiteContent } from "@/i18n/get-dictionary";

type Props = {
  site: SiteContent;
  locale: Locale;
};

export function Progetti({ site, locale }: Props) {
  const { progetti } = site;
  return (
    <Section id="progetti" className="bg-white">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {progetti.title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">{progetti.subtitle}</p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {progetti.items.map((p, index) => {
          const href = p.href ? localePath(locale, p.href) : undefined;
          const badge = progetti.badges[p.badgeKey];
          const card = (
            <>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-diste-azure/0 via-transparent to-diste-green/0 opacity-0 transition duration-300 group-hover:opacity-100 group-hover:from-diste-azure/5 group-hover:to-diste-green/10" />
              <div className="relative flex items-start justify-between gap-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-diste-blue to-diste-green text-sm font-bold text-white shadow-md">
                  {(index + 1).toString().padStart(2, "0")}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide shadow-sm ring-1 ${
                    p.href
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-white text-diste-blue ring-slate-200/80"
                  }`}
                >
                  {badge}
                </span>
              </div>
              <h3 className="relative mt-5 text-xl font-semibold text-slate-900">{p.name}</h3>
              <p className="relative mt-3 flex-1 text-sm leading-relaxed text-slate-600">
                {p.description}
              </p>
              {href ? (
                <span className="relative mt-4 text-sm font-semibold text-diste-blue">
                  {progetti.buyLink}
                </span>
              ) : null}
            </>
          );

          const className =
            "group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-diste-azure/25 hover:bg-white hover:shadow-xl";

          if (href) {
            return (
              <Link key={p.name} href={href} className={className}>
                {card}
              </Link>
            );
          }
          return (
            <article key={p.name} className={className}>
              {card}
            </article>
          );
        })}
      </div>
    </Section>
  );
}
