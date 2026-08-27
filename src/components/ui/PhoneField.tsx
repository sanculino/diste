"use client";

import { callingCodeForCountry } from "@/lib/validation/phone";

type Props = {
  country: string;
  locale: "it" | "en";
  labels: {
    phone: string;
    phoneHint: string;
    phoneInvalid: string;
  };
  error?: string;
  defaultNational?: string;
};

export function PhoneField({ country, locale, labels, error, defaultNational = "" }: Props) {
  const callingCode = callingCodeForCountry(country) || "+";

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    e.target.value = e.target.value.replace(/\D/g, "");
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    e.currentTarget.value = text;
  }

  return (
    <div className="sm:col-span-2">
      <label className="text-sm font-medium text-slate-700" htmlFor="phone_national">
        {labels.phone}
      </label>
      <div className="mt-1 flex gap-2">
        <div
          className="flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700"
          aria-hidden
        >
          {callingCode}
        </div>
        <input
          id="phone_national"
          key={country}
          name="phone_national_number"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="tel-national"
          defaultValue={defaultNational.replace(/\D/g, "")}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-diste-azure focus:ring-2 focus:ring-diste-azure/30"
          onChange={onChange}
          onPaste={onPaste}
          placeholder={locale === "it" ? "3331234567" : "5551234567"}
          required
        />
        <input type="hidden" name="phone_country" value={country} />
      </div>
      <p className="mt-1 text-xs text-slate-500">{labels.phoneHint}</p>
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
