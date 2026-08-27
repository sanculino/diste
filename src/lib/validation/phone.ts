import {
  type CountryCode,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js";

export type PhoneParts = {
  phone_country: string;
  phone_calling_code: string;
  phone_national_number: string;
  phone_e164: string;
};

const ALL_COUNTRIES = getCountries();

export function callingCodeForCountry(country: string): string {
  const cc = country.toUpperCase();
  if (cc === "OTHER") return "";
  try {
    if (!ALL_COUNTRIES.includes(cc as CountryCode)) return "";
    return `+${getCountryCallingCode(cc as CountryCode)}`;
  } catch {
    return "";
  }
}

/** Digits only from user input (national number). */
export function digitsOnlyNational(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function validateAndNormalizePhone(
  country: string,
  nationalDigits: unknown,
): { ok: true; phone: PhoneParts } | { ok: false; error: string } {
  const cc = country.toUpperCase();
  const digits = digitsOnlyNational(nationalDigits);
  if (!digits) {
    return { ok: false, error: "Phone number is required" };
  }
  if (cc === "OTHER") {
    return { ok: false, error: "Select a country for phone validation" };
  }
  if (!ALL_COUNTRIES.includes(cc as CountryCode)) {
    return { ok: false, error: "Unsupported country for phone" };
  }
  const calling = callingCodeForCountry(cc);
  const parsed = parsePhoneNumberFromString(`+${getCountryCallingCode(cc as CountryCode)}${digits}`, cc as CountryCode);
  if (!parsed || !parsed.isValid()) {
    return { ok: false, error: "Invalid phone number for selected country" };
  }
  return {
    ok: true,
    phone: {
      phone_country: cc,
      phone_calling_code: calling,
      phone_national_number: parsed.nationalNumber,
      phone_e164: parsed.format("E.164"),
    },
  };
}

export function isValidNationalInput(value: string): boolean {
  return /^\d*$/.test(value);
}
