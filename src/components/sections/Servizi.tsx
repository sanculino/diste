import type { ReactNode } from "react";
import { Section } from "@/components/ui/Section";
import { servizi } from "@/content/site";

function IconShell({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const icons = [
  <IconShell key="1">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </IconShell>,
  <IconShell key="2">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M8 7h8M8 11h6" />
  </IconShell>,
  <IconShell key="3">
    <path d="M3 21h18" />
    <path d="M5 21V7l8-4v18" />
    <path d="M19 21V11l-6-4" />
    <path d="M9 9v.01" />
    <path d="M9 12v.01" />
    <path d="M9 15v.01" />
    <path d="M9 18v.01" />
  </IconShell>,
  <IconShell key="4">
    <path d="m16 18 6-6-6-6" />
    <path d="m8 6-6 6 6 6" />
  </IconShell>,
];

export function Servizi() {
  return (
    <Section
      id="servizi"
      className="bg-gradient-to-b from-slate-50 via-white to-slate-50"
    >
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {servizi.title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          Competenze trasversali per qualità, sicurezza, ambiente, compliance e
          digital transformation.
        </p>
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {servizi.items.map((item, i) => (
          <article
            key={item.title}
            className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-xl hover:shadow-diste-blue/10"
          >
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-diste-blue to-diste-green text-white shadow-md">
              {icons[i]}
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              {item.title}
            </h3>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
              {item.description}
            </p>
            <div className="mt-4 h-0.5 w-0 rounded-full bg-gradient-to-r from-diste-blue to-diste-green transition-all duration-300 group-hover:w-full" />
          </article>
        ))}
      </div>
    </Section>
  );
}
