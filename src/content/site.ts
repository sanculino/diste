/** Contenuti centralizzati: modifica qui per aggiornare testi e liste. */

export const navLinks = [
  { href: "/#chi-siamo", label: "Chi siamo" },
  { href: "/#mission", label: "Mission & Vision" },
  { href: "/#servizi", label: "Servizi" },
  { href: "/#software", label: "Software" },
  { href: "/#progetti", label: "Progetti" },
  { href: "/pm-web-agent", label: "PM Web Agent" },
  { href: "/#clienti", label: "Clienti" },
  { href: "/#partner", label: "Partner" },
  { href: "/#contatti", label: "Contatti" },
] as const;

export const navLinksEn = [
  { href: "/en#chi-siamo", label: "About us" },
  { href: "/en#mission", label: "Mission & Vision" },
  { href: "/en#servizi", label: "Services" },
  { href: "/en#software", label: "Software" },
  { href: "/en#progetti", label: "Projects" },
  { href: "/en/pm-web-agent", label: "PM Web Agent" },
  { href: "/en#clienti", label: "Clients" },
  { href: "/en#partner", label: "Partners" },
  { href: "/en#contatti", label: "Contact" },
] as const;

export const hero = {
  title:
    "Consulenza, Innovazione e Soluzioni Digitali per Aziende e Pubbliche Amministrazioni",
  subtitle:
    "DI.S.TE. MANAGEMENT S.a.s. affianca imprese, enti pubblici e organizzazioni nella consulenza direzionale, nei sistemi di gestione, nella formazione professionale e nello sviluppo di software, app e gestionali su misura.",
  ctaPrimary: "Richiedi una consulenza",
  ctaSecondary: "Scopri i nostri progetti",
};

export const chiSiamo = {
  title: "Chi siamo",
  body:
    "DI.S.TE. MANAGEMENT – Dipartimento Studi Territoriali è un’azienda con sedi in Italia e Spagna che offre consulenza a organismi pubblici e privati nel campo della direzione, organizzazione aziendale e sistemi di gestione. Opera da oltre 20 anni nel settore della consulenza dei sistemi di gestione, sviluppando attività attorno agli standard ISO internazionali.",
};

export const missionVision = {
  title: "Mission & Vision",
  mission: {
    heading: "Mission",
    text:
      "Supportare imprese, pubbliche amministrazioni e organizzazioni con competenze consolidate in consulenza, formazione e digitalizzazione, garantendo metodo, conformità normativa e soluzioni operative che generano valore misurabile nel tempo.",
  },
  vision: {
    heading: "Vision",
    text:
      "Essere un partner di riferimento in Italia e in Europa per sistemi di gestione, innovazione digitale e piattaforme software verticali, unendo rigore tecnico, visione territoriale e capacità di integrare persone, processi e tecnologia.",
  },
};

export const servizi = {
  title: "Servizi principali",
  items: [
    {
      title: "Consulenza Sistemi di Gestione",
      description:
        "ISO 9001, ISO 27001, ISO 14001, ISO 45001, ISO 22000, ISO 37001, ISO 50001, PDR 125:2022, Modello 231, BIM.",
    },
    {
      title: "Formazione Aziendale",
      description:
        "Corsi ISO, Lead Auditor, Cyber Security, BIM, parità di genere, sicurezza lavoratori.",
    },
    {
      title: "Direzione e Organizzazione Aziendale",
      description:
        "Supporto a imprese, enti pubblici e organizzazioni per migliorare efficienza, efficacia, processi e gestione interna.",
    },
    {
      title: "Software, App e Gestionali",
      description:
        "Sviluppo di applicazioni web, gestionali aziendali, marketplace, sistemi di automazione, CRM, piattaforme per ordini, produzione, tracciabilità e marketing.",
    },
  ],
};

export const software = {
  title: "Software, App e Gestionali per ogni categoria commerciale",
  body:
    "DI.S.TE. MANAGEMENT sviluppa e studia soluzioni digitali per aziende, attività commerciali e settori verticali. Realizziamo gestionali, piattaforme web, marketplace, sistemi di automazione, raccolta dati, tracciabilità, marketing e strumenti per migliorare l’organizzazione aziendale.",
};

export const progetti = {
  title: "Progetti e piattaforme in sviluppo",
  items: [
    {
      name: "Upostu",
      description:
        "Marketplace per la disponibilità e ricerca di parcheggi. Sistema pensato per permettere agli utenti di segnalare posti liberi e aiutare chi cerca parcheggio.",
      href: undefined as string | undefined,
      badge: "In sviluppo",
    },
    {
      name: "Sanculino",
      description:
        "Marketplace dedicato al turismo, pensato per mettere in contatto visitatori, attività locali, servizi turistici, esperienze e offerte territoriali.",
      href: undefined as string | undefined,
      badge: "In sviluppo",
    },
    {
      name: "PM Web Agent",
      description:
        "Software Windows per business discovery e ricerca commerciale B2B su aziende italiane: lead research, supplier discovery e organizzazione contatti.",
      href: "/pm-web-agent",
      enHref: "/en/pm-web-agent",
      badge: "In vendita",
    },
    {
      name: "Gestionale Commesse Edilizia",
      description:
        "Piattaforma per aziende del settore edilizio per gestire clienti, prodotti, ordini, commesse, storico, categorie, documenti e workflow aziendali.",
      href: undefined as string | undefined,
      badge: "In sviluppo",
    },
    {
      name: "BeanOS",
      description:
        "Gestionale per aziende che producono capsule e cialde di caffè. Deve gestire ordini, clienti, agenti, produzione, lotti, tracciabilità, magazzino, miscele e avanzamento lavorazioni.",
      href: undefined as string | undefined,
      badge: "In sviluppo",
    },
  ],
};

export const clienti = {
  title: "Si sono affidati a noi",
  names: [
    "Comune di Catania",
    "Taormina Comune Digitale",
    "Le Giornate dell’Economia del Mezzogiorno",
    "Civico Di Cristina Benfratelli",
    "Cobra Group Italia",
    "AST Aeroservizi S.p.A.",
    "Be Confluence",
    "Banca Popolare Sant’Angelo",
    "Istituto Zooprofilattico Sperimentale della Sicilia",
    "Sicurtransport",
    "Fondazione Curella",
    "AIOP Sicilia",
  ],
};

export const partner = {
  title: "I nostri Partner",
  names: [
    "NGA",
    "IAF",
    "EIACI",
    "IWZ",
    "Allianz",
    "We-Learn",
    "IBC",
    "CALyMAC",
    "Sicurezza Lab S.r.l.",
  ],
};

export const contatti = {
  title: "Contatti",
  italia: {
    label: "Italia",
    lines: [
      "Via del Bersagliere 45",
      "90143 Palermo",
      "Tel. +39 091 5751728",
      "Cell. +39 393 8110109",
    ],
  },
  spagna: {
    label: "Spagna",
    lines: [
      "C/ Lago Michigan 22",
      "28529 Rivas-Vaciamadrid",
      "Cell. +34 687272083",
    ],
  },
  email: "info@distemanagement.com",
  website: "www.distemanagement.com",
};
