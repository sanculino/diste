/** Server-side text sanitization — preserves Unicode, blocks HTML/control abuse. */

const HTML_TAG = /<[^>]*>/g;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export type TextFieldKind =
  | "name"
  | "company"
  | "address"
  | "city"
  | "region"
  | "postal"
  | "email"
  | "tax_id"
  | "order_id"
  | "license_id"
  | "claim_token"
  | "notes"
  | "generic";

const MAX: Record<TextFieldKind, number> = {
  name: 200,
  company: 300,
  address: 500,
  city: 120,
  region: 120,
  postal: 32,
  email: 254,
  tax_id: 64,
  order_id: 128,
  license_id: 64,
  claim_token: 256,
  notes: 2000,
  generic: 500,
};

export function normalizeUnicodeText(value: unknown, maxLen?: number): string {
  if (value === null || value === undefined) return "";
  let s = String(value).normalize("NFC").replace(CONTROL_CHARS, "").trim();
  s = s.replace(HTML_TAG, "");
  if (maxLen !== undefined && s.length > maxLen) {
    s = s.slice(0, maxLen);
  }
  return s;
}

export function sanitizeTextField(value: unknown, kind: TextFieldKind): string {
  return normalizeUnicodeText(value, MAX[kind]);
}

export function sanitizeEmail(value: unknown): string {
  const email = sanitizeTextField(value, "email").toLowerCase();
  if (!email || email.length > MAX.email) return "";
  if (!/^[^\s@<>\"']+@[^\s@<>\"']+\.[^\s@<>\"']+$/.test(email)) return "";
  return email;
}

export function sanitizeOrderId(value: unknown): string {
  const id = sanitizeTextField(value, "order_id");
  if (!id || id.length > 128) return "";
  if (!/^[A-Za-z0-9._-]+$/.test(id)) return "";
  return id;
}

export function sanitizeLicenseId(value: unknown): string {
  const id = sanitizeTextField(value, "license_id").toUpperCase();
  if (!id.startsWith("PMWA-LIC-")) return "";
  if (!/^PMWA-LIC-[A-Z0-9-]+$/.test(id)) return "";
  return id;
}

export function sanitizeClaimToken(value: unknown): string {
  const t = sanitizeTextField(value, "claim_token");
  if (!t || t.length < 16 || t.length > 256) return "";
  if (!/^[A-Za-z0-9_-]+$/.test(t)) return "";
  return t;
}

export function sanitizeCountryCode(value: unknown): string {
  const c = sanitizeTextField(value, "generic").toUpperCase();
  if (c === "OTHER") return "OTHER";
  if (/^[A-Z]{2}$/.test(c)) return c;
  return "";
}

/** Escape for plain-text email bodies (not HTML templates). */
export function escapePlainText(value: string): string {
  return value.replace(/[\r\n]/g, " ").trim();
}
