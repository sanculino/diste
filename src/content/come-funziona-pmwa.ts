/** PM Web Agent guide content — IT / EN */

import type { Locale } from "@/i18n/config";

const it = {
  title: "Come funziona",
  intro:
    "PM Web Agent è un software desktop Windows per la ricerca commerciale B2B su aziende italiane. Raccoglie informazioni aziendali pubblicamente disponibili, le organizza in un database locale e supporta export e attività di business research.",
  pills: [
    "Database locale (SQLite)",
    "Esportazione CSV/Excel",
    "Ricerca per categoria e località",
    "Windows Desktop Application",
  ],
  sections: [
    {
      title: "1) Ricerca aziende",
      paragraphs: [
        "Nel tab Ricerca selezioni categorie merceologiche, zona geografica e limiti, poi avvii la raccolta.",
      ],
      bullets: [
        "Categorie (una per riga o separate con ;)",
        "Zona: Regione → Provincia → Comune, località manuale, oppure Tutta Italia",
        "Limiti configurabili per schede e pagine",
      ],
      after:
        "Il programma raccoglie risultati da fonti pubbliche e li salva nel database locale sul PC.",
      note: "Versione Demo: funzionalità limitate per la prova gratuita.",
    },
    {
      title: "2) Database e export",
      paragraphs: ["I contatti salvati restano in locale (SQLite). Puoi esportare in CSV per Excel o altri strumenti."],
      bullets: ["Visualizzazione e selezione contatti", "Eliminazione righe", "Export CSV"],
    },
    {
      title: "3) Utilizzo responsabile",
      paragraphs: [
        "Utilizza PM Web Agent per business research e B2B lead research nel rispetto della privacy e della normativa applicabile.",
      ],
      note:
        "Il software non autorizza comunicazioni commerciali non consentite. Verifica sempre le basi giuridiche per contattare le aziende.",
    },
  ],
  faq: [] as { q: string; a: string }[],
};

const en = {
  title: "How it works",
  intro:
    "PM Web Agent is a Windows desktop application for B2B business lead research on Italian companies. It collects publicly available business information, organizes it in a local database and supports export for your sales workflow.",
  pills: [
    "Local database (SQLite)",
    "CSV/Excel export",
    "Search by category and location",
    "Windows Desktop Application",
  ],
  sections: [
    {
      title: "1) Company search",
      paragraphs: [
        "In the Search tab you select business categories, geographic area and limits, then start the collection.",
      ],
      bullets: [
        "Categories (one per line or separated by ;)",
        "Area: Region → Province → City, manual location, or All Italy",
        "Configurable limits for listings and pages",
      ],
      after:
        "The application collects results from public sources and saves them to your local database on your PC.",
      note: "Demo version: limited features for free trial.",
    },
    {
      title: "2) Database and export",
      paragraphs: [
        "Saved contacts remain local (SQLite). You can export to CSV for Excel or other tools.",
      ],
      bullets: ["View and select contacts", "Delete rows", "CSV export"],
    },
    {
      title: "3) Responsible use",
      paragraphs: [
        "Use PM Web Agent for business research and B2B lead research in compliance with privacy laws and applicable regulations.",
      ],
      note:
        "The software does not authorize unsolicited commercial communications. Always verify the legal basis before contacting businesses.",
    },
  ],
  faq: [] as { q: string; a: string }[],
};

export function comeFunzionaPmwa(locale: Locale) {
  return locale === "en" ? en : it;
}
