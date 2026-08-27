"use client";

import { useMemo, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { PmwaDictionary } from "@/i18n/get-dictionary";
import {
  formatEuro,
  isItaly,
  productPmwa,
} from "@/content/product-pmwa";
import { PhoneField } from "@/components/ui/PhoneField";
import { FieldError } from "@/components/ui/FieldError";
import { validateAndNormalizePhone } from "@/lib/validation/phone";

const COUNTRIES: { code: string; name: string; nameEn: string }[] = [
  { code: "IT", name: "Italia", nameEn: "Italy" },
  { code: "DE", name: "Germania", nameEn: "Germany" },
  { code: "FR", name: "Francia", nameEn: "France" },
  { code: "ES", name: "Spagna", nameEn: "Spain" },
  { code: "GB", name: "Regno Unito", nameEn: "United Kingdom" },
  { code: "US", name: "Stati Uniti", nameEn: "United States" },
  { code: "OTHER", name: "Altro", nameEn: "Other" },
];

function makeOrderId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `RNW-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`.toUpperCase();
}

type ClientType = "company" | "individual";

type Eligibility = {
  license_id: string;
  plan: "1pc" | "3pc";
  expires_utc: string;
};

type Props = {
  locale: Locale;
  dict: PmwaDictionary;
};

export function RenewPmwa({ locale, dict }: Props) {
  const r = dict.renewal;
  const clientType: ClientType = "company";
  const [country, setCountry] = useState("IT");
  const [orderId] = useState(() => makeOrderId());
  const [licenseId, setLicenseId] = useState("");
  const [verifyEmail, setVerifyEmail] = useState("");
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [billingReady, setBillingReady] = useState(false);
  const [billingEmail, setBillingEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const billingFormRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const localeTag = locale === "it" ? "it-IT" : "en-GB";
  const paypalLocale = locale === "it" ? "IT" : "US";

  const planCard = useMemo(() => {
    if (!eligibility) return null;
    return eligibility.plan === "1pc" ? dict.plan1pc : dict.plan3pc;
  }, [dict.plan1pc, dict.plan3pc, eligibility]);

  const planPrice = eligibility?.plan === "3pc" ? 150 : 70;

  async function verifyLicense(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError(null);
    const lid = licenseId.trim().toUpperCase();
    const em = verifyEmail.trim();
    if (!lid || !em) {
      setVerifyError(r.verifyRequired);
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/renewal/eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license_id: lid, email: em }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || r.verifyFailed);
      }
      setEligibility({
        license_id: data.license_id,
        plan: data.plan,
        expires_utc: data.expires_utc,
      });
      setBillingEmail(em);
    } catch (err) {
      setEligibility(null);
      setVerifyError(err instanceof Error ? err.message : r.verifyFailed);
    } finally {
      setVerifying(false);
    }
  }

  function validate(form: HTMLFormElement): boolean {
    const fd = new FormData(form);
    const next: Record<string, string> = {};
    const email = String(fd.get("email") || "").trim();
    const address = String(fd.get("address") || "").trim();
    const city = String(fd.get("city") || "").trim();
    const postal = String(fd.get("postal_code") || "").trim();
    const privacy = fd.get("privacy") === "on";
    const e = dict.errors;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = e.email;
    if (!address) next.address = e.address;
    if (!postal) next.postal_code = e.postalCode;
    if (!city) next.city = e.city;
    const cty = String(fd.get("country") || "IT").toUpperCase();
    if (!privacy) next.privacy = e.privacy;

    const phoneCountry = String(fd.get("phone_country") || cty).toUpperCase();
    const phoneNational = String(fd.get("phone_national_number") || "");
    const phoneCheck = validateAndNormalizePhone(phoneCountry, phoneNational);
    if (!phoneCheck.ok) next.phone = e.phone;

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function buildBillingPayload(form: HTMLFormElement) {
    const fd = new FormData(form);
    const cty = String(fd.get("country") || "IT").toUpperCase();
    const email = String(fd.get("email") || "").trim();
    const phoneCountry = String(fd.get("phone_country") || cty).toUpperCase();
    const phoneNational = String(fd.get("phone_national_number") || "");
    const phoneCheck = validateAndNormalizePhone(phoneCountry, phoneNational);
    return {
      order_id: orderId,
      plan: eligibility!.plan,
      customer_email: email,
      customer_type: clientType,
      company_name: clientType === "company" ? String(fd.get("company_name") || "").trim() : undefined,
      billing_name:
        clientType === "company"
          ? String(fd.get("company_name") || "").trim()
          : String(fd.get("person_name") || "").trim(),
      billing_address: String(fd.get("address") || "").trim(),
      city: String(fd.get("city") || "").trim(),
      region: String(fd.get("province") || "").trim() || undefined,
      postal_code: String(fd.get("postal_code") || "").trim(),
      country: cty,
      phone_country: phoneCheck.ok ? phoneCheck.phone.phone_country : phoneCountry,
      phone_national_number: phoneCheck.ok ? phoneCheck.phone.phone_national_number : phoneNational,
      vat_tax_id: String(fd.get("vat_number") || "").trim() || undefined,
      billing_json: {},
      is_renewal: true,
      renewal_license_id: eligibility!.license_id,
    };
  }

  async function ensureRenewalOrder(): Promise<boolean> {
    const form = billingFormRef.current;
    if (!form || !eligibility || !validate(form)) return false;
    setSubmitting(true);
    try {
      const payload = buildBillingPayload(form);
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Order save failed");
      setBillingEmail(payload.customer_email);
      setBillingReady(true);
      return true;
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Error");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  function siteOrigin(): string {
    if (typeof window !== "undefined") return window.location.origin;
    return process.env.NEXT_PUBLIC_SITE_URL || "";
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-diste-azure focus:ring-2 focus:ring-diste-azure/30";

  const renewPath = locale === "en" ? "/en/pm-web-agent/renew" : "/pm-web-agent/rinnova";
  const successPath = locale === "en" ? "/en/purchase/success" : "/purchase/success";

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">{r.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{r.subtitle}</p>
        <p className="mt-4 text-sm text-amber-800 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          {r.noReinstall}
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">{r.verifyTitle}</h2>
        <p className="mt-2 text-sm text-slate-600">{r.verifyNote}</p>
        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={verifyLicense} noValidate>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="license_id">
              {r.licenseId}
            </label>
            <input
              id="license_id"
              name="license_id"
              className={inputClass}
              placeholder="PMWA-LIC-..."
              value={licenseId}
              onChange={(e) => setLicenseId(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="verify_email">
              {r.purchaseEmail}
            </label>
            <input
              id="verify_email"
              name="verify_email"
              type="email"
              className={inputClass}
              value={verifyEmail}
              onChange={(e) => setVerifyEmail(e.target.value)}
              required
            />
          </div>
          {verifyError ? (
            <p className="sm:col-span-2 text-sm text-rose-600">{verifyError}</p>
          ) : null}
          {eligibility ? (
            <div className="sm:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {r.verified.replace("{plan}", planCard?.title || eligibility.plan).replace(
                "{expires}",
                eligibility.expires_utc?.slice(0, 10) || "—",
              )}
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={verifying}
              className="inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {verifying ? r.verifying : r.verifyButton}
            </button>
          </div>
        </form>
      </section>

      {eligibility ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900">{dict.billing.title}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {dict.billing.orderNote}:{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{orderId}</code>
            </p>
            <form
              ref={billingFormRef}
              className="mt-6 grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (validate(e.currentTarget)) {
                  setBillingEmail(String(new FormData(e.currentTarget).get("email") || "").trim());
                  setBillingReady(true);
                }
              }}
              noValidate
            >
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="email">
                  {dict.billing.email}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className={inputClass}
                  defaultValue={billingEmail}
                  required
                />
                <FieldError message={errors.email} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="country">
                  {dict.billing.country}
                </label>
                <select
                  id="country"
                  name="country"
                  className={inputClass}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {locale === "it" ? c.name : c.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              {clientType === "company" ? (
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="company_name">
                    {dict.billing.companyName}
                  </label>
                  <input id="company_name" name="company_name" className={inputClass} />
                </div>
              ) : (
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="person_name">
                    {dict.billing.personName}
                  </label>
                  <input id="person_name" name="person_name" className={inputClass} />
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="address">
                  {dict.billing.address}
                </label>
                <input id="address" name="address" className={inputClass} required />
                <FieldError message={errors.address} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="postal_code">
                  {dict.billing.postalCode}
                </label>
                <input id="postal_code" name="postal_code" className={inputClass} required />
                <FieldError message={errors.postal_code} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="city">
                  {dict.billing.city}
                </label>
                <input id="city" name="city" className={inputClass} required />
                <FieldError message={errors.city} />
              </div>
              {isItaly(country) ? (
                <div>
                  <label className="text-sm font-medium text-slate-700" htmlFor="province">
                    {dict.billing.province}
                  </label>
                  <input id="province" name="province" maxLength={2} className={inputClass} />
                </div>
              ) : null}
              {isItaly(country) && clientType === "company" ? (
                <div>
                  <label className="text-sm font-medium text-slate-700" htmlFor="vat_number">
                    {dict.billing.italianVat}
                  </label>
                  <input id="vat_number" name="vat_number" className={inputClass} />
                </div>
              ) : null}
              <PhoneField
                country={country}
                locale={locale}
                labels={{
                  phone: dict.billing.phone,
                  phoneHint: dict.billing.phoneHint,
                  phoneInvalid: dict.errors.phone,
                }}
                error={errors.phone}
              />
              <div className="sm:col-span-2">
                <label className="flex items-start gap-2 text-sm text-slate-600">
                  <input name="privacy" type="checkbox" className="mt-1" required />
                  <span>{dict.billing.privacy}</span>
                </label>
                <FieldError message={errors.privacy} />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {dict.billing.submit}
                </button>
                {billingReady ? (
                  <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    {dict.billing.success}
                  </p>
                ) : null}
              </div>
            </form>
          </section>

          <section id="renew-pricing" className="rounded-2xl border border-diste-blue/20 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-bold text-slate-900">{planCard?.title}</h2>
            <p className="mt-2 text-4xl font-bold text-diste-blue">
              {planCard?.price}
              <span className="text-lg font-medium text-slate-500">{planCard?.period}</span>
            </p>
            <p className="mt-2 text-sm text-slate-600">{r.renewPeriod}</p>
            <form
              action={productPmwa.paypalCheckoutUrl}
              method="post"
              target="_top"
              className="mt-6 max-w-md"
              onSubmit={async (ev) => {
                const ok = await ensureRenewalOrder();
                if (!ok) {
                  ev.preventDefault();
                  window.alert(dict.paypal.invoiceRequired);
                }
              }}
            >
              <input type="hidden" name="cmd" value="_xclick" />
              <input type="hidden" name="business" value={productPmwa.paypalBusiness} />
              <input
                type="hidden"
                name="item_name"
                value={dict.renewalItemNames[eligibility.plan]}
              />
              <input type="hidden" name="amount" value={planPrice.toFixed(2)} />
              <input type="hidden" name="currency_code" value={productPmwa.currency} />
              <input type="hidden" name="charset" value="utf-8" />
              <input type="hidden" name="lc" value={paypalLocale} />
              <input type="hidden" name="no_shipping" value="1" />
              <input type="hidden" name="custom" value={orderId} />
              <input type="hidden" name="invoice" value={orderId} />
              <input type="hidden" name="notify_url" value={`${siteOrigin()}/api/paypal/ipn`} />
              <input
                type="hidden"
                name="return"
                value={`${siteOrigin()}${successPath}?order=${encodeURIComponent(orderId)}`}
              />
              <input type="hidden" name="cancel_return" value={`${siteOrigin()}${renewPath}`} />
              {billingEmail ? <input type="hidden" name="email" value={billingEmail} /> : null}
              <button
                type="submit"
                className="w-full rounded-full bg-[#ffc439] px-4 py-3 text-sm font-bold text-[#003087] hover:brightness-105"
              >
                {dict.paypal.payButton} — {formatEuro(planPrice, localeTag)}€
              </button>
            </form>
            <p className="mt-3 text-xs text-slate-500">{r.afterPay}</p>
          </section>
        </>
      ) : null}
    </div>
  );
}
