import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { ChiSiamo } from "@/components/sections/ChiSiamo";
import { MissionVision } from "@/components/sections/MissionVision";
import { Servizi } from "@/components/sections/Servizi";
import { SoftwareInnovazione } from "@/components/sections/SoftwareInnovazione";
import { Progetti } from "@/components/sections/Progetti";
import { Clienti } from "@/components/sections/Clienti";
import { Partner } from "@/components/sections/Partner";
import { Contatti } from "@/components/sections/Contatti";
import { getDictionary } from "@/i18n/get-dictionary";

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

export default async function EnglishHomePage() {
  const dict = await getDictionary("en");
  return (
    <>
      <Header />
      <main>
        <Hero
          site={dict.site}
          showPmwaCta
          pmwaHref="/en/pm-web-agent"
        />
        <ChiSiamo site={dict.site} />
        <MissionVision site={dict.site} />
        <Servizi site={dict.site} />
        <SoftwareInnovazione site={dict.site} />
        <Progetti site={dict.site} locale="en" />
        <Clienti site={dict.site} />
        <Partner site={dict.site} />
        <Contatti site={dict.site} />
      </main>
      <Footer />
    </>
  );
}
