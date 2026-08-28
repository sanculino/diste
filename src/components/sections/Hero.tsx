import { GradientButton } from "@/components/ui/GradientButton";
import type { SiteContent } from "@/i18n/get-dictionary";

type Props = {
  site: SiteContent;
  showPmwaCta?: boolean;
  pmwaHref?: string;
};

export function Hero({ site, showPmwaCta, pmwaHref }: Props) {
  const { hero } = site;
  return (
    <div className="relative overflow-hidden border-b border-slate-200/80 bg-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(42,159,214,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(31,163,160,0.2),transparent_50%)]"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-20 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8 lg:flex-row lg:items-center lg:gap-16">
        <div className="max-w-3xl flex-1">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-diste-blue">
            {hero.badge}
          </p>
          <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            {hero.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
            {hero.subtitle}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <GradientButton href="#contatti">{hero.ctaPrimary}</GradientButton>
            <GradientButton variant="outline" href="#progetti">
              {hero.ctaSecondary}
            </GradientButton>
            {showPmwaCta && pmwaHref ? (
              <GradientButton variant="outline" href={pmwaHref}>
                {hero.pmwaCta}
              </GradientButton>
            ) : null}
          </div>
        </div>
        <div className="relative flex flex-1 justify-center lg:justify-end">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-8 shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-diste-azure/30 to-diste-green/30 blur-2xl" />
            <div className="absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-gradient-to-tr from-diste-blue/20 to-diste-azure/20 blur-2xl" />
            <ul className="relative space-y-4 text-sm text-slate-700">
              {hero.highlights.map((item) => (
                <li key={item.strong} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gradient-to-r from-diste-blue to-diste-green" />
                  <span>
                    <strong className="text-slate-900">{item.strong}</strong>
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
