import { Section } from "@/components/ui/Section";
import type { SiteContent } from "@/i18n/get-dictionary";

type Props = { site: SiteContent };

export function MissionVision({ site }: Props) {
  const { missionVision } = site;
  return (
    <Section id="mission" className="bg-white">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {missionVision.title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">{missionVision.subtitle}</p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-diste-azure/30 hover:shadow-lg">
          <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-gradient-to-br from-diste-blue/10 to-transparent transition group-hover:scale-110" />
          <h3 className="relative text-xl font-semibold text-diste-blue">
            {missionVision.mission.heading}
          </h3>
          <p className="relative mt-4 leading-relaxed text-slate-600">
            {missionVision.mission.text}
          </p>
        </article>
        <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-8 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-diste-green/30 hover:shadow-lg">
          <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-gradient-to-br from-diste-green/10 to-transparent transition group-hover:scale-110" />
          <h3 className="relative text-xl font-semibold text-diste-green-deep">
            {missionVision.vision.heading}
          </h3>
          <p className="relative mt-4 leading-relaxed text-slate-600">
            {missionVision.vision.text}
          </p>
        </article>
      </div>
    </Section>
  );
}
