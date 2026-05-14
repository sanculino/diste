import { Section } from "@/components/ui/Section";
import { clienti } from "@/content/site";

export function Clienti() {
  return (
    <Section id="clienti" className="bg-slate-50/90">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {clienti.title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          Organizzazioni pubbliche e private che hanno scelto il nostro supporto
          per consulenza, formazione e innovazione.
        </p>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {clienti.names.map((name) => (
          <div
            key={name}
            className="flex min-h-[88px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-5 text-center text-sm font-semibold text-slate-800 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-diste-azure/30 hover:shadow-md"
          >
            {name}
          </div>
        ))}
      </div>
    </Section>
  );
}
