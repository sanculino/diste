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

export default async function Home() {
  const dict = await getDictionary("it");
  return (
    <>
      <Header />
      <main>
        <Hero site={dict.site} />
        <ChiSiamo site={dict.site} />
        <MissionVision site={dict.site} />
        <Servizi site={dict.site} />
        <SoftwareInnovazione site={dict.site} />
        <Progetti site={dict.site} locale="it" />
        <Clienti site={dict.site} />
        <Partner site={dict.site} />
        <Contatti site={dict.site} />
      </main>
      <Footer />
    </>
  );
}
