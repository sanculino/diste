/** Config vendita Palermo Business Agent su distemanagementsoftware.it */

export const productPba = {
  slug: "palermo-business-agent",
  name: "Palermo Business Agent",
  tagline: "Raccolta contatti, mailing list e sviluppo commerciale — 1 anno di licenza.",
  pec: "distemanagement@pec.it",
  email: "info@distemanagement.com",
  vatRate: 0.22,
  currency: "EUR",
  /** Email / Merchant ID PayPal Business */
  paypalBusiness: "ballestrinofrancisco@gmail.com",
  plans: {
    standard: {
      id: "1pc",
      title: "Licenza 1 PC / 1 anno",
      net: 49,
      maxMachines: 1,
      itemName: "Palermo Business Agent — Licenza 1 PC / 1 anno",
      downloadZip: "/downloads/PalermoBusinessAgent_Setup_1PC_1Y.zip",
      tokenHint: "NCC1-....",
    },
    pro: {
      id: "3pc",
      title: "Licenza fino a 3 PC / 1 anno",
      net: 99,
      maxMachines: 3,
      itemName: "Palermo Business Agent — Licenza fino a 3 PC / 1 anno",
      downloadZip: "/downloads/PalermoBusinessAgent_Setup_3PC_1Y.zip",
      tokenHint: "NCC3-....",
    },
  },
  demoZip: "/downloads/PalermoBusinessAgent_Setup_Demo.zip",
  howItWorks: [
    "Compila i dati per la fattura elettronica e inviali via email (PEC).",
    "Paga con PayPal il piano scelto (importo IVA inclusa).",
    "Ricevi via email il codice di attivazione (NCC1-… o NCC3-…).",
    "Scarica il setup, installa e inserisci il codice una sola volta: si lega a questo PC.",
  ],
  guideUrl: "/palermo-business-agent/come-funziona",
} as const;

export function grossWithVat(net: number, vatRate = productPba.vatRate): number {
  return Math.round(net * (1 + vatRate) * 100) / 100;
}

export function formatEuro(amount: number): string {
  return amount.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
