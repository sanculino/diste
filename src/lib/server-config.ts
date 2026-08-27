/** Server-side configuration (never expose secrets to the client). */

export const licenseApiUrl = (
  process.env.LICENSE_API_URL || "http://127.0.0.1:8090"
).replace(/\/$/, "");

export const licenseAdminKey = process.env.LICENSE_ADMIN_KEY || "";

export const paypalBusinessEmail = (
  process.env.PAYPAL_BUSINESS_EMAIL || "ballestrinofrancisco@gmail.com"
).trim().toLowerCase();

export const paypalIpnVerifyUrl =
  process.env.PAYPAL_IPN_VERIFY_URL ||
  "https://www.paypal.com/cgi-bin/webscr";

/** PayPal Website Payments Standard checkout form action (sandbox or live). */
export const paypalCheckoutUrl =
  process.env.PAYPAL_CHECKOUT_URL ||
  process.env.NEXT_PUBLIC_PAYPAL_CHECKOUT_URL ||
  "https://www.paypal.com/cgi-bin/webscr";

export const siteUrl = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export const privateInstallersDir =
  process.env.PRIVATE_INSTALLERS_DIR ||
  `${process.cwd()}/private/downloads`;

export const planAmounts = { "1pc": 70, "3pc": 150 } as const;

export type PlanId = keyof typeof planAmounts;
