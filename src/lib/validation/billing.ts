import { planAmounts, type PlanId } from "@/lib/server-config";
import {
  sanitizeCountryCode,
  sanitizeEmail,
  sanitizeLicenseId,
  sanitizeOrderId,
  sanitizeTextField,
} from "./sanitize";
import { validateAndNormalizePhone, type PhoneParts } from "./phone";

export type BillingInput = {
  order_id: string;
  plan: PlanId;
  customer_email: string;
  customer_type?: string;
  company_name?: string;
  billing_name?: string;
  billing_address?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  country?: string;
  vat_tax_id?: string;
  phone_country?: string;
  phone_national_number?: string;
  billing_json?: Record<string, unknown>;
  is_renewal?: boolean;
  renewal_license_id?: string;
};

export type ValidatedBilling = {
  order_id: string;
  plan: PlanId;
  customer_email: string;
  customer_type: string;
  company_name?: string;
  billing_name: string;
  billing_address: string;
  city: string;
  region?: string;
  postal_code: string;
  country: string;
  vat_tax_id?: string;
  billing_json: Record<string, unknown>;
  is_renewal?: boolean;
  renewal_license_id?: string;
};

function sanitizeBillingJson(raw: Record<string, unknown> | undefined, country: string): Record<string, unknown> {
  const src = raw || {};
  const out: Record<string, unknown> = {};
  const first = sanitizeTextField(src.first_name, "name");
  const last = sanitizeTextField(src.last_name, "name");
  const person = sanitizeTextField(src.person_name, "name");
  const sdi = sanitizeTextField(src.sdi, "generic");
  const pec = sanitizeEmail(src.pec);
  if (first) out.first_name = first;
  if (last) out.last_name = last;
  if (person) out.person_name = person;
  if (country === "IT" && sdi) out.sdi = sdi.toUpperCase();
  if (country === "IT" && pec) out.pec = pec;
  return out;
}

export function validateBillingBody(body: BillingInput):
  | { ok: true; data: ValidatedBilling; phone: PhoneParts }
  | { ok: false; error: string } {
  const plan = body.plan;
  if (plan !== "1pc" && plan !== "3pc") {
    return { ok: false, error: "Invalid plan" };
  }
  if (!planAmounts[plan]) {
    return { ok: false, error: "Invalid plan amount" };
  }

  const order_id = sanitizeOrderId(body.order_id);
  if (!order_id) return { ok: false, error: "Invalid order_id" };

  const customer_email = sanitizeEmail(body.customer_email);
  if (!customer_email) return { ok: false, error: "Invalid email" };

  const country = sanitizeCountryCode(body.country || "IT") || "IT";
  const customer_type = body.customer_type === "individual" ? "individual" : "company";

  const company_name = sanitizeTextField(body.company_name, "company") || undefined;
  const billing_name = sanitizeTextField(body.billing_name, "name");
  const billing_address = sanitizeTextField(body.billing_address, "address");
  const city = sanitizeTextField(body.city, "city");
  const region = sanitizeTextField(body.region, "region") || undefined;
  const postal_code = sanitizeTextField(body.postal_code, "postal");
  const vat_tax_id = sanitizeTextField(body.vat_tax_id, "tax_id") || undefined;

  if (!billing_name) return { ok: false, error: "billing_name required" };
  if (!billing_address) return { ok: false, error: "address required" };
  if (!city) return { ok: false, error: "city required" };
  if (!postal_code) return { ok: false, error: "postal_code required" };

  const phoneCountry = sanitizeCountryCode(body.phone_country || country) || country;
  const phoneResult = validateAndNormalizePhone(phoneCountry, body.phone_national_number);
  if (!phoneResult.ok) return phoneResult;

  const billing_json = sanitizeBillingJson(body.billing_json, country);
  billing_json.phone_country = phoneResult.phone.phone_country;
  billing_json.phone_calling_code = phoneResult.phone.phone_calling_code;
  billing_json.phone_national_number = phoneResult.phone.phone_national_number;
  billing_json.phone_e164 = phoneResult.phone.phone_e164;

  const is_renewal = Boolean(body.is_renewal);
  let renewal_license_id: string | undefined;
  if (is_renewal) {
    renewal_license_id = sanitizeLicenseId(body.renewal_license_id);
    if (!renewal_license_id) return { ok: false, error: "Invalid renewal_license_id" };
  }

  return {
    ok: true,
    phone: phoneResult.phone,
    data: {
      order_id,
      plan,
      customer_email,
      customer_type,
      company_name,
      billing_name,
      billing_address,
      city,
      region,
      postal_code,
      country,
      vat_tax_id,
      billing_json,
      is_renewal: is_renewal || undefined,
      renewal_license_id,
    },
  };
}

export function validateRenewalCheckBody(body: { license_id?: unknown; email?: unknown }) {
  const license_id = sanitizeLicenseId(body.license_id);
  const email = sanitizeEmail(body.email);
  if (!license_id) return { ok: false as const, error: "Invalid license_id" };
  if (!email) return { ok: false as const, error: "Invalid email" };
  return { ok: true as const, license_id, email };
}

export function validateOrderStatusParam(orderId: string) {
  const id = sanitizeOrderId(orderId);
  if (!id) return { ok: false as const, error: "Invalid order" };
  return { ok: true as const, order_id: id };
}
