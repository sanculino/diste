"use client";

import { useMemo, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { PmwaDictionary } from "@/i18n/get-dictionary";
import {
  formatEuro,
  isEu,
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
  { code: "CA", name: "Canada", nameEn: "Canada" },
  { code: "JP", name: "Giappone", nameEn: "Japan" },
  { code: "KR", name: "Corea del Sud", nameEn: "South Korea" },
  { code: "AU", name: "Australia", nameEn: "Australia" },
  { code: "BR", name: "Brasile", nameEn: "Brazil" },
  { code: "AE", name: "Emirati Arabi Uniti", nameEn: "United Arab Emirates" },
  { code: "CN", name: "Cina", nameEn: "China" },
  { code: "AT", name: "Austria", nameEn: "Austria" },
  { code: "BE", name: "Belgio", nameEn: "Belgium" },
  { code: "NL", name: "Paesi Bassi", nameEn: "Netherlands" },
  { code: "PL", name: "Polonia", nameEn: "Poland" },
  { code: "PT", name: "Portogallo", nameEn: "Portugal" },
  { code: "CH", name: "Svizzera", nameEn: "Switzerland" },
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
  return `ORD-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`.toUpperCase();
}

type ClientType = "company" | "individual";

type Props = {
  locale: Locale;
  dict: PmwaDictionary;
};

export function PurchasePmwa({ locale, dict }: Props) {
  const [clientType, setClientType] = useState<ClientType>("company");
  const [country, setCountry] = useState("IT");
  const [orderId] = useState(() => makeOrderId());
  const [billingReady, setBillingReady] = useState(false);
  const [billingEmail, setBillingEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const billingFormRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const localeTag = locale === "it" ? "it-IT" : "en-GB";
  const paypalLocale = locale === "it" ? "IT" : "US";

  const plans = useMemo(
    () => [
      { key: "standard" as const, plan: productPmwa.plans.standard },
      { key: "pro" as const, plan: productPmwa.plans.pro },
    ],
    [],
  );

  function validate(form: HTMLFormElement): boolean {
    const fd = new FormData(form);
    const next: Record<string, string> = {};
    const email = String(fd.get("email") || "").trim();
    const address = String(fd.get("address") || "").trim();
    const city = String(fd.get("city") || "").trim();
    const postal = String(fd.get("postal_code") || "").trim();
    const cty = String(fd.get("country") || "IT").toUpperCase();
    const privacy = fd.get("privacy") === "on";
    const e = dict.errors;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = e.email;
    if (!address) next.address = e.address;
    if (!postal) next.postal_code = e.postalCode;
    if (!city) next.city = e.city;

    if (clientType === "company") {
      const company = String(fd.get("company_name") || "").trim();
      if (!company) next.company_name = e.companyName;
      if (isItaly(cty)) {
        const vat = String(fd.get("vat_number") || "").replace(/\s+/g, "");
        if (!/^\d{11}$/.test(vat)) next.vat_number = e.vatItalian;
        const sdi = String(fd.get("sdi") || "").trim().toUpperCase();
        const pec = String(fd.get("pec") || "").trim();
        if (!sdi && !pec) {
          next.sdi = e.sdiOrPec;
          next.pec = e.sdiOrPec;
        }
        if (sdi && !/^[A-Z0-9]{7}$/.test(sdi)) next.sdi = e.sdi;
        if (pec && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pec)) next.pec = e.pec;
      } else if (isEu(cty)) {
        const vat = String(fd.get("vat_number") || "").trim();
        if (vat && vat.length < 4) next.vat_number = e.vatEu;
      }
    } else {
      if (isItaly(cty)) {
        const person = String(fd.get("person_name") || "").trim();
        if (!person) next.person_name = e.personName;
        const cf = String(fd.get("fiscal_code") || "").replace(/\s+/g, "").toUpperCase();
        if (cf && !/^[A-Z0-9]{16}$/.test(cf)) next.fiscal_code = e.fiscalCode;
      } else {
        const fn = String(fd.get("first_name") || "").trim();
        const ln = String(fd.get("last_name") || "").trim();
        if (!fn) next.first_name = e.firstName;
        if (!ln) next.last_name = e.lastName;
      }
    }

    if (isItaly(cty)) {
      const prov = String(fd.get("province") || "").trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(prov)) next.province = e.province;
    }

    if (!privacy) next.privacy = e.privacy;

    const phoneCountry = String(fd.get("phone_country") || cty).toUpperCase();
    const phoneNational = String(fd.get("phone_national_number") || "");
    const phoneCheck = validateAndNormalizePhone(phoneCountry, phoneNational);
    if (!phoneCheck.ok) next.phone = e.phone;

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function buildBillingPayload(form: HTMLFormElement, planId: "1pc" | "3pc") {
    const fd = new FormData(form);
    const cty = String(fd.get("country") || "IT").toUpperCase();
    const email = String(fd.get("email") || "").trim();
    const billingName =
      clientType === "company"
        ? String(fd.get("company_name") || "").trim()
        : isItaly(cty)
          ? String(fd.get("person_name") || "").trim()
          : `${String(fd.get("first_name") || "").trim()} ${String(fd.get("last_name") || "").trim()}`.trim();

    const phoneCountry = String(fd.get("phone_country") || cty).toUpperCase();
    const phoneNational = String(fd.get("phone_national_number") || "");
    const phoneCheck = validateAndNormalizePhone(phoneCountry, phoneNational);

    return {
      order_id: orderId,
      plan: planId,
      customer_email: email,
      customer_type: clientType,
      company_name: clientType === "company" ? String(fd.get("company_name") || "").trim() : undefined,
      billing_name: billingName,
      billing_address: String(fd.get("address") || "").trim(),
      city: String(fd.get("city") || "").trim(),
      region: String(fd.get("province") || fd.get("region") || "").trim() || undefined,
      postal_code: String(fd.get("postal_code") || "").trim(),
      country: cty,
      phone_country: phoneCheck.ok ? phoneCheck.phone.phone_country : phoneCountry,
      phone_national_number: phoneCheck.ok ? phoneCheck.phone.phone_national_number : phoneNational,
      vat_tax_id:
        String(fd.get("vat_number") || fd.get("fiscal_code") || fd.get("tax_id") || "").trim() ||
        undefined,
      billing_json: {
        sdi: isItaly(cty) ? String(fd.get("sdi") || "").trim() : undefined,
        pec: isItaly(cty) ? String(fd.get("pec") || "").trim() : undefined,
        first_name: String(fd.get("first_name") || "").trim() || undefined,
        last_name: String(fd.get("last_name") || "").trim() || undefined,
        person_name: String(fd.get("person_name") || "").trim() || undefined,
      },
    };
  }

  async function onBillingSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!validate(form)) return;
    setBillingEmail(String(new FormData(form).get("email") || "").trim());
    setBillingReady(true);
  }

  async function ensureOrderForPlan(planId: "1pc" | "3pc"): Promise<boolean> {
    const form = billingFormRef.current;
    if (!form || !validate(form)) {
      document.getElementById("fattura")?.scrollIntoView({ behavior: "smooth" });
      return false;
    }
    setSubmitting(true);
    try {
      const payload = buildBillingPayload(form, planId);
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Order save failed");
      }
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

  const showItalianFields = isItaly(country);
  const showEuCompany = clientType === "company" && isEu(country) && !isItaly(country);

  return (
    <div className="space-y-12">
      {"international" in dict && dict.international ? (
        <section className="rounded-2xl border border-diste-azure/20 bg-gradient-to-br from-cyan-50/80 to-white p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900">{dict.international.title}</h2>
          <p className="mt-3 text-slate-600 leading-relaxed">{dict.international.body}</p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">{dict.useCases.title}</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {dict.useCases.items.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-slate-700">
              <span className="text-diste-green">✓</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">{dict.useCases.disclaimer}</p>
      </section>

      <ol className="grid gap-3 sm:grid-cols-2">
        {dict.howItWorks.map((step, i) => (
          <li
            key={step}
            className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-diste-blue text-xs font-bold text-white">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {/* Billing — step 1 */}
      <section id="fattura" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold text-slate-900">{dict.billing.title}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {dict.billing.orderNote}:{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{orderId}</code>
          {" — "}
          {dict.billing.orderLinked}
        </p>

        <form
          ref={billingFormRef}
          className="mt-6 grid gap-4 sm:grid-cols-2"
          onSubmit={onBillingSubmit}
          noValidate
        >
          <div className="sm:col-span-2">
            <p className="text-sm font-semibold text-slate-800">{dict.billing.customerType}</p>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  checked={clientType === "company"}
                  onChange={() => setClientType("company")}
                />
                {dict.billing.company}
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  checked={clientType === "individual"}
                  onChange={() => setClientType("individual")}
                />
                {dict.billing.individual}
              </label>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="email">
              {dict.billing.email}
            </label>
            <input id="email" name="email" type="email" className={inputClass} required />
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
            <>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="company_name">
                  {dict.billing.companyName}
                </label>
                <input id="company_name" name="company_name" className={inputClass} />
                <FieldError message={errors.company_name} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="vat_number">
                  {showItalianFields
                    ? dict.billing.italianVat
                    : showEuCompany
                      ? dict.billing.euVat
                      : dict.billing.taxId}
                </label>
                <input id="vat_number" name="vat_number" className={inputClass} />
                <FieldError message={errors.vat_number} />
              </div>
              {!showItalianFields && !showEuCompany ? (
                <div>
                  <label className="text-sm font-medium text-slate-700" htmlFor="tax_id">
                    {dict.billing.taxId}
                  </label>
                  <input id="tax_id" name="tax_id" className={inputClass} />
                </div>
              ) : null}
            </>
          ) : showItalianFields ? (
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="person_name">
                {dict.billing.personName}
              </label>
              <input id="person_name" name="person_name" className={inputClass} />
              <FieldError message={errors.person_name} />
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="first_name">
                  {dict.billing.firstName}
                </label>
                <input id="first_name" name="first_name" className={inputClass} />
                <FieldError message={errors.first_name} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="last_name">
                  {dict.billing.lastName}
                </label>
                <input id="last_name" name="last_name" className={inputClass} />
                <FieldError message={errors.last_name} />
              </div>
            </>
          )}

          {showItalianFields && clientType === "individual" ? (
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="fiscal_code">
                {dict.billing.fiscalCode}
              </label>
              <input id="fiscal_code" name="fiscal_code" className={inputClass} />
              <FieldError message={errors.fiscal_code} />
            </div>
          ) : null}

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

          {showItalianFields ? (
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="province">
                {dict.billing.province}
              </label>
              <input id="province" name="province" maxLength={2} className={inputClass} />
              <FieldError message={errors.province} />
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="region">
                {dict.billing.region}
              </label>
              <input id="region" name="region" className={inputClass} />
            </div>
          )}

          {showItalianFields && clientType === "company" ? (
            <>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="sdi">
                  {dict.billing.sdi}
                </label>
                <input id="sdi" name="sdi" className={inputClass} />
                <FieldError message={errors.sdi} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="pec">
                  {dict.billing.pec}
                </label>
                <input id="pec" name="pec" type="email" className={inputClass} />
                <FieldError message={errors.pec} />
              </div>
              <p className="sm:col-span-2 text-xs text-slate-500">
                {dict.billing.italianFieldsNote}
              </p>
            </>
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
            {billingReady && (
              <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {dict.billing.success}
              </p>
            )}
          </div>
        </form>
      </section>

      {/* Pricing + PayPal — step 2 */}
      <section id="pricing" className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-900">{dict.pricingTitle}</h2>
        <p className="text-sm text-slate-600">{dict.pricingNote}</p>
        <div className="grid gap-6 md:grid-cols-3">
          <article className="flex flex-col rounded-2xl border-2 border-diste-green/30 bg-gradient-to-b from-emerald-50/50 to-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-diste-green-deep">
              {dict.demo.title}
            </p>
            <p className="mt-2 text-4xl font-bold text-slate-900">{dict.demo.price}</p>
            <p className="mt-1 text-sm text-slate-600">{dict.demo.subtitle}</p>
            <p className="mt-3 flex-1 text-sm text-slate-500">{dict.demo.description}</p>
            <a
              href={productPmwa.demoSetup}
              className="mt-6 inline-flex justify-center rounded-full bg-gradient-to-r from-diste-blue via-diste-azure to-diste-green px-4 py-3 text-sm font-bold text-white shadow-md hover:brightness-110"
            >
              {dict.demo.cta}
            </a>
          </article>

          {plans.map(({ key, plan }) => {
            const card = key === "standard" ? dict.plan1pc : dict.plan3pc;
            const planId = plan.id as "1pc" | "3pc";
            return (
              <article
                key={key}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <p className="text-sm font-semibold uppercase tracking-wide text-diste-blue">
                  {card.title}
                </p>
                <p className="mt-2 text-4xl font-bold text-diste-blue">
                  {card.price}
                  <span className="text-lg font-medium text-slate-500">{card.period}</span>
                </p>
                <p className="mt-1 text-sm text-slate-600">{card.subtitle}</p>
                <ul className="mt-4 flex-1 space-y-1 text-sm text-slate-600">
                  {card.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                <form
                  action={productPmwa.paypalCheckoutUrl}
                  method="post"
                  target="_top"
                  className="mt-6"
                  onSubmit={async (ev) => {
                    const ok = await ensureOrderForPlan(planId);
                    if (!ok) {
                      ev.preventDefault();
                      window.alert(dict.paypal.invoiceRequired);
                    }
                  }}
                >
                  <input type="hidden" name="cmd" value="_xclick" />
                  <input type="hidden" name="business" value={productPmwa.paypalBusiness} />
                  <input type="hidden" name="item_name" value={dict.itemNames[planId]} />
                  <input type="hidden" name="amount" value={plan.price.toFixed(2)} />
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
                    value={`${siteOrigin()}${locale === "en" ? "/en" : ""}/purchase/success?order=${encodeURIComponent(orderId)}`}
                  />
                  <input
                    type="hidden"
                    name="cancel_return"
                    value={`${siteOrigin()}${locale === "en" ? "/en" : ""}/pm-web-agent#pricing`}
                  />
                  {billingEmail ? (
                    <input type="hidden" name="email" value={billingEmail} />
                  ) : null}
                  <button
                    type="submit"
                    className="w-full rounded-full bg-[#ffc439] px-4 py-3 text-sm font-bold text-[#003087] hover:brightness-105"
                  >
                    {dict.paypal.payButton} — {formatEuro(plan.price, localeTag)}€
                  </button>
                </form>
                <p className="mt-3 text-center text-xs text-slate-500">
                  {dict.paypal.postPurchase}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
