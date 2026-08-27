/** PM Web Agent — product config for distemanagementsoftware.it */

export const productPmwa = {
  slug: "pm-web-agent",
  name: "PM Web Agent",
  pec: "distemanagement@pec.it",
  email: "info@distemanagementsoftware.it",
  currency: "EUR",
  /** PayPal Business — unchanged */
  paypalBusiness: "ballestrinofrancisco@gmail.com",
  /** PayPal checkout endpoint — override via NEXT_PUBLIC_PAYPAL_CHECKOUT_URL for sandbox */
  paypalCheckoutUrl:
    process.env.NEXT_PUBLIC_PAYPAL_CHECKOUT_URL ||
    "https://www.paypal.com/cgi-bin/webscr",
  /** Public demo installer (signed Setup.exe) */
  /** Public demo download — tracked server-side */
  demoSetup: "/api/download/demo",
  /** Commercial installers — delivered post-purchase only (not public URLs) */
  commercialSetup: {
    "1pc": "PMWebAgent_1PC_Setup.exe",
    "3pc": "PMWebAgent_3PC_Setup.exe",
  },
  plans: {
    standard: {
      id: "1pc",
      price: 70,
      maxMachines: 1,
      tokenHint: "NCC1-....",
    },
    pro: {
      id: "3pc",
      price: 150,
      maxMachines: 3,
      tokenHint: "NCC3-....",
    },
  },
} as const;

export function formatEuro(amount: number, locale = "it-IT"): string {
  return amount.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/** EU member country codes (ISO 3166-1 alpha-2) for billing logic */
export const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

export function isItaly(country: string): boolean {
  return country.toUpperCase() === "IT";
}

export function isEu(country: string): boolean {
  return EU_COUNTRIES.has(country.toUpperCase());
}
