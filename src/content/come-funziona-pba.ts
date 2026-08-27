/** Contenuti guida “Come funziona” (origine: ncc/contacts-collector-landing/come-funziona.html) */

export const comeFunzionaPba = {
  title: "Come funziona",
  intro:
    "Palermo Business Agent è un software desktop per raccogliere contatti di attività, organizzarli in un database locale e usarli per marketing email e strumenti operativi (etichette, WhatsApp, import Google Maps).",
  pills: [
    "Database locale (SQLite)",
    "Esportazione CSV/Excel",
    "Campagne email con segnaposto",
    "Import Google Maps (Places)",
  ],
  sections: [
    {
      title: "1) Ricerca (raccolta contatti)",
      paragraphs: [
        "Nel tab Ricerca scegli categorie, zona geografica e limiti, poi avvii la raccolta.",
      ],
      bullets: [
        "Categorie (una per riga o separate con ;)",
        "Zona: Regione → Provincia → Comune, località manuale (es. “Palermo, PA”), oppure Tutta Italia",
        "Limiti: massimo schede totali e massimo pagine elenco/categoria",
        "Opzioni: headless (browser invisibile) e modalità più veloce",
      ],
      after:
        "Quando premi Avvia ricerca, il programma apre Chromium e raccoglie i risultati da PagineGialle.it, salvandoli automaticamente nel database.",
      note: "Versione Demo: limita l’estrazione a max 50 nominativi per categoria.",
    },
    {
      title: "2) Database contatti",
      paragraphs: [
        "Nel tab Database trovi l’elenco dei contatti salvati in SQLite sul PC (non serve cloud).",
      ],
      bullets: [
        "Vedere e selezionare contatti",
        "Eliminare righe",
        "Esportare in CSV (Excel o altri strumenti)",
      ],
      after:
        "I campi supportati includono (in base a cosa viene trovato): nome attività, indirizzo, CAP, provincia, località, telefono, email, sito web, social, WhatsApp, link fonte, ecc.",
    },
    {
      title: "3) Marketing (email)",
      paragraphs: ["Nel tab Marketing puoi:"],
      bullets: [
        "Scrivere l’email (anche da testo semplice → conversione HTML)",
        "Inviare una prova",
        "Inviare una campagna a contatti del database oppure a un CSV importato",
        "Usare segnaposto nel testo (es. [NOME_ATTIVITA], [INDIRIZZO], [EMAIL], ecc.)",
        "Allegare file (PDF/immagini)",
        "Registrare un log invii in invii_marketing.csv",
      ],
      note:
        "Disiscrizione (unsubscribe): con l’opzione “Footer disiscrizione + List-Unsubscribe” puoi gestire le richieste e mantenere mailing_list_disiscritti.txt, evitando invii futuri verso quegli indirizzi.",
    },
    {
      title: "4) Etichette",
      paragraphs: [
        "Nel tab Etichette puoi generare un PDF di etichette a partire dai contatti salvati.",
      ],
    },
    {
      title: "5) Impostazioni",
      paragraphs: ["Nel tab Impostazioni configuri:"],
      bullets: [
        "Server SMTP (Gmail o altro provider)",
        "Credenziali e porta (TLS/SSL)",
        "Parametri utili per invii e integrazioni",
      ],
    },
    {
      title: "Dove salva i dati",
      paragraphs: ["Il programma salva tutto in locale, nella cartella dati dell’app:"],
      bullets: [
        "database.db (contatti e campagne)",
        "invii_marketing.csv (registro invii)",
        "mailing_list_disiscritti.txt (email escluse)",
      ],
      note:
        "Usa volumi e frequenze ragionevoli e rispetta termini d’uso dei portali e normativa privacy/GDPR. La qualità dei dati dipende dalla disponibilità delle informazioni pubbliche.",
    },
  ],
  faq: [
    {
      q: "Pagine Gialle o Google Maps?",
      a: "Pagine Gialle: ideale per aziende consolidate, telefoni e categorie merceologiche precise. Google Maps: copertura più ampia, anche attività recenti, con rating e orari. Incrociando le fonti riduci i duplicati.",
    },
    {
      q: "Google Maps ha un costo?",
      a: "Google Cloud offre di solito un credito gratuito mensile (verifica condizioni aggiornate). Oltre la soglia paghi solo il consumo a Google; per un uso normale la quota gratuita è spesso sufficiente.",
    },
  ],
} as const;
