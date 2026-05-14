import { Section } from "@/components/ui/Section";
import { chiSiamo } from "@/content/site";

export function ChiSiamo() {
  return (
    <Section id="chi-siamo" className="bg-slate-50/80">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {chiSiamo.title}
          </h2>
          <div className="mt-4 h-1 w-20 rounded-full bg-gradient-to-r from-diste-blue to-diste-green" />
        </div>
        <p className="text-lg leading-relaxed text-slate-600">
          {chiSiamo.body}
        </p>
      </div>
    </Section>
  );
}
