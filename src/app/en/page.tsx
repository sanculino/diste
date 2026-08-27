import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ChiSiamo } from "@/components/sections/ChiSiamo";
import { MissionVision } from "@/components/sections/MissionVision";
import { Servizi } from "@/components/sections/Servizi";
import { SoftwareInnovazione } from "@/components/sections/SoftwareInnovazione";
import { Progetti } from "@/components/sections/Progetti";
import { Clienti } from "@/components/sections/Clienti";
import { Partner } from "@/components/sections/Partner";
import { Contatti } from "@/components/sections/Contatti";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export const metadata: Metadata = {
  title: "DI.S.TE. MANAGEMENT | Consulting, Innovation and Digital Solutions",
  description:
    "Consulting, management systems, professional training and custom software for businesses and public administrations. Offices in Italy and Spain.",
  alternates: {
    canonical: "https://distemanagementsoftware.it/en",
    languages: {
      it: "https://distemanagementsoftware.it/",
      en: "https://distemanagementsoftware.it/en",
    },
  },
};

export default function EnglishHomePage() {
  return (
    <>
      <Header />
      <div className="fixed right-4 top-20 z-40 sm:right-6">
        <LanguageSwitcher locale="en" switchLabel="Italiano" />
      </div>
      <main>
        <section className="border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-cyan-50/40">
          <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 lg:px-8">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-diste-azure">
              Italy &amp; Spain · Over 20 years of experience
            </p>
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              Consulting, Innovation and Digital Solutions for Businesses and Public Administrations
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-600">
              DI.S.TE. MANAGEMENT supports companies, public entities and organizations with
              management consulting, ISO management systems, professional training and custom
              software development.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#contatti"
                className="rounded-full bg-gradient-to-r from-diste-blue via-diste-azure to-diste-green px-6 py-3 text-sm font-semibold text-white shadow-lg"
              >
                Request a consultation
              </a>
              <Link
                href="/en/pm-web-agent"
                className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800"
              >
                PM Web Agent — Find Italian Business Leads
              </Link>
            </div>
          </div>
        </section>
        <ChiSiamo />
        <MissionVision />
        <Servizi />
        <SoftwareInnovazione />
        <Progetti locale="en" />
        <Clienti />
        <Partner />
        <Contatti />
      </main>
      <Footer />
    </>
  );
}
