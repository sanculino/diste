import { Section } from "@/components/ui/Section";
import type { SiteContent } from "@/i18n/get-dictionary";

type Props = { site: SiteContent };

export function Contatti({ site }: Props) {
  const { contatti } = site;
  return (
    <Section id="contatti" className="bg-slate-100/80">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {contatti.title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">{contatti.subtitle}</p>
      </div>
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-diste-blue">
            {contatti.italia.label}
          </h3>
          <ul className="mt-4 space-y-2 text-slate-600">
            {contatti.italia.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-diste-green-deep">
            {contatti.spagna.label}
          </h3>
          <ul className="mt-4 space-y-2 text-slate-600">
            {contatti.spagna.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-diste-blue to-diste-green p-6 text-white shadow-lg">
          <h3 className="text-sm font-bold uppercase tracking-wide text-white/90">
            {contatti.digitalComms}
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <span className="block text-white/70">{contatti.emailLabel}</span>
              <a
                className="font-semibold underline decoration-white/40 underline-offset-4 hover:decoration-white"
                href={`mailto:${contatti.email}`}
              >
                {contatti.email}
              </a>
            </li>
            <li>
              <span className="block text-white/70">{contatti.websiteLabel}</span>
              <a
                className="font-semibold underline decoration-white/40 underline-offset-4 hover:decoration-white"
                href="https://www.distemanagement.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                {contatti.website}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </Section>
  );
}
