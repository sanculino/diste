import { Section } from "@/components/ui/Section";
import { partner } from "@/content/site";

export function Partner() {
  return (
    <Section id="partner" className="bg-white">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {partner.title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          Rete di collaborazioni con istituzioni, enti di formazione e player
          assicurativi e tecnologici.
        </p>
      </div>
      <div className="mt-12 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
        {partner.names.map((name) => (
          <span
            key={name}
            className="rounded-full border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm transition duration-300 hover:border-diste-green/40 hover:shadow-md"
          >
            {name}
          </span>
        ))}
      </div>
    </Section>
  );
}
