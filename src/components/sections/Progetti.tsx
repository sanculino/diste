import { Section } from "@/components/ui/Section";
import { progetti } from "@/content/site";

export function Progetti() {
  return (
    <Section id="progetti" className="bg-white">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {progetti.title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          Piattaforme e prodotti digitali in evoluzione, progettati con
          attenzione al territorio e alle esigenze dei settori verticali.
        </p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {progetti.items.map((p, index) => (
          <article
            key={p.name}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-diste-azure/25 hover:bg-white hover:shadow-xl"
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-diste-azure/0 via-transparent to-diste-green/0 opacity-0 transition duration-300 group-hover:opacity-100 group-hover:from-diste-azure/5 group-hover:to-diste-green/10" />
            <div className="relative flex items-start justify-between gap-4">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-diste-blue to-diste-green text-sm font-bold text-white shadow-md">
                {(index + 1).toString().padStart(2, "0")}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-diste-blue shadow-sm ring-1 ring-slate-200/80">
                In sviluppo
              </span>
            </div>
            <h3 className="relative mt-5 text-xl font-semibold text-slate-900">
              {p.name}
            </h3>
            <p className="relative mt-3 flex-1 text-sm leading-relaxed text-slate-600">
              {p.description}
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}
