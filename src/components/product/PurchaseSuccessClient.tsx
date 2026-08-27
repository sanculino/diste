"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";

type Props = {
  locale: Locale;
  orderId: string;
};

type OrderStatus = {
  paid: boolean;
  payment_status: string;
  plan?: string;
  customer_email?: string;
  activation_claim_token?: string;
  download_token?: string;
  license_id?: string;
  is_renewal?: boolean;
};

const copy = {
  it: {
    title: "Ordine PM Web Agent",
    renewalTitle: "Rinnovo PM Web Agent",
    pending: "La conferma del pagamento è in elaborazione.",
    paid: "Pagamento confermato. Scarica l'installer e avvia PM Web Agent.",
    renewalPaid:
      "Rinnovo confermato. La licenza è stata estesa di 12 mesi. Nessuna azione richiesta sull'installazione esistente.",
    download: "Scarica installer",
    order: "Codice ordine",
    email: "Email acquisto",
    license: "ID licenza",
    claim: "Riferimento attivazione",
    activate:
      "Al primo avvio inserisci email, codice ordine e riferimento attivazione. Non serve un codice licenza manuale.",
    renewalNote:
      "Al prossimo avvio online PM Web Agent rileverà automaticamente la nuova data di scadenza.",
    back: "Torna a PM Web Agent",
    poll: "Aggiornamento automatico…",
  },
  en: {
    title: "PM Web Agent Order",
    renewalTitle: "PM Web Agent Renewal",
    pending: "Payment confirmation is being processed.",
    paid: "Payment confirmed. Download the installer and launch PM Web Agent.",
    renewalPaid:
      "Renewal confirmed. Your license has been extended by 12 months. No action required on your existing installation.",
    download: "Download installer",
    order: "Order ID",
    email: "Purchase email",
    license: "License ID",
    claim: "Activation reference",
    activate:
      "On first launch enter your email, order ID and activation reference. No manual license code required.",
    renewalNote:
      "On the next online launch PM Web Agent will automatically pick up the new expiry date.",
    back: "Back to PM Web Agent",
    poll: "Checking automatically…",
  },
};

export function PurchaseSuccessClient({ locale, orderId }: Props) {
  const t = copy[locale];
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let attempts = 0;

    async function load() {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Not found");
        if (alive) {
          setStatus(data);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Error");
      }
    }

    load();
    const timer = setInterval(() => {
      attempts += 1;
      load();
      if (attempts > 40) clearInterval(timer);
    }, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [orderId]);

  const paid = Boolean(status?.paid);
  const isRenewal = Boolean(status?.is_renewal);
  const pmwaHref = locale === "en" ? "/en/pm-web-agent" : "/pm-web-agent";

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">
        {isRenewal ? t.renewalTitle : t.title}
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        {t.order}: <code className="rounded bg-slate-100 px-2 py-0.5">{orderId}</code>
      </p>

      {error ? <p className="mt-6 text-rose-600">{error}</p> : null}

      {!paid ? (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <p>{t.pending}</p>
          <p className="mt-2 text-sm opacity-80">{t.poll}</p>
        </div>
      ) : (
        <div className="mt-8 space-y-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-6">
          <p className="font-medium text-emerald-900">
            {isRenewal ? t.renewalPaid : t.paid}
          </p>
          {!isRenewal && status?.download_token ? (
            <a
              href={`/api/download/${encodeURIComponent(status.download_token)}`}
              className="inline-flex rounded-full bg-gradient-to-r from-diste-blue to-diste-green px-5 py-2.5 text-sm font-semibold text-white"
            >
              {t.download}
            </a>
          ) : null}
          <dl className="grid gap-2 text-sm text-slate-700">
            <div>
              <dt className="font-semibold">{t.email}</dt>
              <dd>{status?.customer_email}</dd>
            </div>
            {status?.license_id ? (
              <div>
                <dt className="font-semibold">{t.license}</dt>
                <dd>
                  <code className="break-all rounded bg-white px-2 py-1 text-xs">
                    {status.license_id}
                  </code>
                </dd>
              </div>
            ) : null}
            {!isRenewal && status?.activation_claim_token ? (
              <div>
                <dt className="font-semibold">{t.claim}</dt>
                <dd>
                  <code className="break-all rounded bg-white px-2 py-1 text-xs">
                    {status.activation_claim_token}
                  </code>
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="text-sm text-slate-600">
            {isRenewal ? t.renewalNote : t.activate}
          </p>
        </div>
      )}

      <Link href={pmwaHref} className="mt-10 inline-block text-sm font-semibold text-diste-blue">
        ← {t.back}
      </Link>
    </div>
  );
}
