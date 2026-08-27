"use client";

import { useMemo, useState } from "react";
import {
  formatEuro,
  grossWithVat,
  productPba,
} from "@/content/product-pba";
import { FieldError } from "@/components/ui/FieldError";

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

type ClientType = "company" | "person";

export function PurchasePba() {
  const [clientType, setClientType] = useState<ClientType>("company");
  const [orderId] = useState(() => makeOrderId());
  const [invoiceOk, setInvoiceOk] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const stdGross = useMemo(
    () => grossWithVat(productPba.plans.standard.net),
    [],
  );
  const proGross = useMemo(() => grossWithVat(productPba.plans.pro.net), []);

  function validate(form: HTMLFormElement): boolean {
    const fd = new FormData(form);
    const next: Record<string, string> = {};
    const email = String(fd.get("email") || "").trim();
    const address = String(fd.get("address") || "").trim();
    const cap = String(fd.get("cap") || "").trim();
    const city = String(fd.get("city") || "").trim();
    const province = String(fd.get("province") || "").trim().toUpperCase();
    const sdi = String(fd.get("sdi") || "").trim().toUpperCase();
    const pec = String(fd.get("pec") || "").trim();
    const privacy = fd.get("privacy") === "on";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Email non valida.";
    }
    if (clientType === "company") {
      const company = String(fd.get("company_name") || "").trim();
      const vat = String(fd.get("vat_number") || "").replace(/\s+/g, "");
      if (!company) next.company_name = "Inserisci la ragione sociale.";
      if (!/^\d{11}$/.test(vat)) next.vat_number = "P.IVA: 11 cifre.";
    } else {
      const person = String(fd.get("person_name") || "").trim();
      const cf = String(fd.get("fiscal_code") || "").replace(/\s+/g, "").toUpperCase();
      if (!person) next.person_name = "Inserisci nome e cognome.";
      if (!/^[A-Z0-9]{16}$/.test(cf)) next.fiscal_code = "CF: 16 caratteri.";
    }
    if (!address) next.address = "Indirizzo obbligatorio.";
    if (!/^\d{5}$/.test(cap)) next.cap = "CAP: 5 cifre.";
    if (!city) next.city = "Comune obbligatorio.";
    if (!/^[A-Z]{2}$/.test(province)) next.province = "Provincia: 2 lettere.";
    const sdiOk = !sdi || /^[A-Z0-9]{7}$/.test(sdi);
    const pecOk = !pec || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pec);
    if (!sdiOk) next.sdi = "SDI: 7 caratteri.";
    if (!pecOk) next.pec = "PEC non valida.";
    if (!sdi && !pec) {
      next.sdi = "Inserisci SDI oppure PEC.";
      next.pec = "Inserisci PEC oppure SDI.";
    }
    if (!privacy) next.privacy = "Devi accettare la privacy.";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onInvoiceSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!validate(form)) return;

    const fd = new FormData(form);
    const lines = [
      `Ordine: ${orderId}`,
      `Data (UTC): ${new Date().toISOString()}`,
      "",
      "=== DATI FATTURA ===",
      `Tipo: ${clientType}`,
      `Email PayPal: ${fd.get("email")}`,
      clientType === "company"
        ? `Ragione sociale: ${fd.get("company_name")}`
        : `Nome: ${fd.get("person_name")}`,
      `P.IVA: ${fd.get("vat_number") || ""}`,
      `CF: ${fd.get("fiscal_code") || ""}`,
      `Indirizzo: ${fd.get("address")}`,
      `CAP: ${fd.get("cap")} — ${fd.get("city")} (${String(fd.get("province")).toUpperCase()})`,
      `Nazione: ${fd.get("country") || "IT"}`,
      `SDI: ${fd.get("sdi") || ""}`,
      `PEC: ${fd.get("pec") || ""}`,
      "",
      "Dopo PayPal emettere token con tools/issue_license.py e inviarlo al cliente.",
    ];
    const href =
      `mailto:${encodeURIComponent(productPba.pec)}` +
      `?subject=${encodeURIComponent(`Dati fattura — Palermo Business Agent — ${orderId}`)}` +
      `&body=${encodeURIComponent(lines.join("\n"))}`;
    window.location.href = href;
    setInvoiceOk(true);
  }


  const inputClass =
    "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-diste-azure focus:ring-2 focus:ring-diste-azure/30";

  return (
    <div className="space-y-12">
      <ol className="grid gap-3 sm:grid-cols-2">
        {productPba.howItWorks.map((step, i) => (
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
      <p className="text-sm text-slate-600">
        Vuoi capire ricerca Pagine Gialle, database e marketing?{" "}
        <a href={productPba.guideUrl} className="font-semibold text-diste-blue hover:underline">
          Leggi la guida Come funziona
        </a>
        .
      </p>

      <section id="fattura" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold text-slate-900">1. Dati fattura elettronica</h2>
        <p className="mt-2 text-sm text-slate-600">
          Codice ordine: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{orderId}</code>
          {" — "}
          verrà collegato al pagamento PayPal.
        </p>

        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={onInvoiceSubmit} noValidate>
          <div className="sm:col-span-2">
            <p className="text-sm font-semibold text-slate-800">Tipo cliente</p>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="client_type"
                  checked={clientType === "company"}
                  onChange={() => setClientType("company")}
                />
                Azienda / Professionista
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="client_type"
                  checked={clientType === "person"}
                  onChange={() => setClientType("person")}
                />
                Persona fisica
              </label>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="email">
              Email (usata anche su PayPal)
            </label>
            <input id="email" name="email" type="email" className={inputClass} required />
            <FieldError message={errors.email} />
          </div>

          {clientType === "company" ? (
            <>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="company_name">
                  Ragione sociale
                </label>
                <input id="company_name" name="company_name" className={inputClass} />
                <FieldError message={errors.company_name} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="vat_number">
                  Partita IVA
                </label>
                <input id="vat_number" name="vat_number" className={inputClass} inputMode="numeric" />
                <FieldError message={errors.vat_number} />
              </div>
            </>
          ) : (
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="person_name">
                Nome e cognome
              </label>
              <input id="person_name" name="person_name" className={inputClass} />
              <FieldError message={errors.person_name} />
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="fiscal_code">
              Codice fiscale
            </label>
            <input id="fiscal_code" name="fiscal_code" className={inputClass} />
            <FieldError message={errors.fiscal_code} />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="address">
              Indirizzo
            </label>
            <input id="address" name="address" className={inputClass} required />
            <FieldError message={errors.address} />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="cap">
              CAP
            </label>
            <input id="cap" name="cap" className={inputClass} required />
            <FieldError message={errors.cap} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="city">
              Comune
            </label>
            <input id="city" name="city" className={inputClass} required />
            <FieldError message={errors.city} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="province">
              Provincia
            </label>
            <input id="province" name="province" maxLength={2} className={inputClass} required />
            <FieldError message={errors.province} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="country">
              Nazione
            </label>
            <input id="country" name="country" defaultValue="IT" maxLength={2} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="sdi">
              Codice Destinatario (SDI)
            </label>
            <input id="sdi" name="sdi" className={inputClass} placeholder="7 caratteri" />
            <FieldError message={errors.sdi} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="pec">
              PEC
            </label>
            <input id="pec" name="pec" type="email" className={inputClass} />
            <FieldError message={errors.pec} />
          </div>

          <div className="sm:col-span-2">
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input name="privacy" type="checkbox" className="mt-1" required />
              <span>
                Autorizzo l’uso dei dati per fatturazione e supporto relativo all’acquisto.
              </span>
            </label>
            <FieldError message={errors.privacy} />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Apri email (PEC) con i dati fattura
            </button>
            {invoiceOk && (
              <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Dati pronti. Invia l’email e passa al pagamento PayPal qui sotto.
              </p>
            )}
          </div>
        </form>
      </section>

      <section id="paypal" className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">2. Pagamento PayPal</h2>
        <p className="text-sm text-slate-600">
          Prezzi al netto IVA. PayPal addebita il totale IVA inclusa (22%). Dopo il pagamento
          riceverai il codice di attivazione ({productPba.plans.standard.tokenHint} /{" "}
          {productPba.plans.pro.tokenHint}).
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          {(
            [
              ["standard", productPba.plans.standard, stdGross],
              ["pro", productPba.plans.pro, proGross],
            ] as const
          ).map(([key, plan, gross]) => (
            <article
              key={key}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-slate-900">{plan.title}</h3>
              <p className="mt-2 text-3xl font-bold text-diste-blue">
                {formatEuro(plan.net)}€{" "}
                <span className="text-base font-medium text-slate-500">+ IVA</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Totale {formatEuro(gross)}€ — max {plan.maxMachines} PC
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                <li>Durata 12 mesi</li>
                <li>Attivazione online con codice unico</li>
                <li>Download setup dopo acquisto</li>
              </ul>
              <form
                action="https://www.paypal.com/cgi-bin/webscr"
                method="post"
                target="_top"
                className="mt-6"
                onSubmit={(ev) => {
                  if (!invoiceOk) {
                    ev.preventDefault();
                    document.getElementById("fattura")?.scrollIntoView({ behavior: "smooth" });
                    window.alert("Prima invia i dati fattura (pulsante email PEC).");
                  }
                }}
              >
                <input type="hidden" name="cmd" value="_xclick" />
                <input type="hidden" name="business" value={productPba.paypalBusiness} />
                <input type="hidden" name="item_name" value={plan.itemName} />
                <input type="hidden" name="amount" value={gross.toFixed(2)} />
                <input type="hidden" name="currency_code" value={productPba.currency} />
                <input type="hidden" name="charset" value="utf-8" />
                <input type="hidden" name="lc" value="IT" />
                <input type="hidden" name="no_shipping" value="1" />
                <input type="hidden" name="custom" value={orderId} />
                <input type="hidden" name="invoice" value={orderId} />
                <button
                  type="submit"
                  className="w-full rounded-full bg-[#ffc439] px-4 py-3 text-sm font-bold text-[#003087] hover:brightness-105"
                >
                  Paga con PayPal — {formatEuro(gross)}€
                </button>
              </form>
              <a
                href={plan.downloadZip}
                className="mt-3 text-center text-sm font-medium text-diste-blue hover:underline"
              >
                Link download setup (dopo pagamento)
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Demo gratuita</h2>
        <p className="mt-2 text-sm text-slate-600">
          Prova limitata (periodi/schede demo). Per la versione completa usa PayPal + codice
          attivazione.
        </p>
        <a
          href={productPba.demoZip}
          className="mt-4 inline-flex rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
        >
          Scarica demo
        </a>
      </section>
    </div>
  );
}
