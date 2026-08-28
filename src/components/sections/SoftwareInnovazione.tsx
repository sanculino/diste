import { Section } from "@/components/ui/Section";
import type { SiteContent } from "@/i18n/get-dictionary";

type Props = { site: SiteContent };

export function SoftwareInnovazione({ site }: Props) {
  const { software } = site;
  return (
    <Section
      id="software"
      className="relative overflow-hidden bg-gradient-to-br from-diste-blue via-[#1565a8] to-diste-green-deep text-white"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-soft-light"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, white 0, transparent 35%), radial-gradient(circle at 80% 0%, #7dd3fc 0, transparent 40%)",
        }}
      />
      <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{software.title}</h2>
          <p className="mt-6 text-lg leading-relaxed text-white/90">{software.body}</p>
        </div>
        <div className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-md sm:p-8">
          <ul className="space-y-4 text-sm sm:text-base">
            {software.bullets.map((line) => (
              <li key={line} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-white" />
                <span className="text-white/95">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
