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

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <ChiSiamo />
        <MissionVision />
        <Servizi />
        <SoftwareInnovazione />
        <Progetti />
        <Clienti />
        <Partner />
        <Contatti />
      </main>
      <Footer />
    </>
  );
}
