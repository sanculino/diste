# FINAL PRE-DEPLOY — Security + Customer Form + Demo Download Analytics

**Project:** `C:\Users\massimo\Documents\progetti\distemanagement`  
**Date:** 2026-08-27  
**Scope:** Local only — no deploy, commit, push, VPS, Azure signing, or installer changes.

---

## Executive summary

Security hardening, international phone validation, and server-side demo download analytics are implemented locally. PayPal purchase, renewal, and protected commercial download flows are preserved. The DEMO installer byte hash is unchanged.

---

## PART A — XSS audit

### A1 — Input inventory (PM Web Agent + APIs)

| FIELD | PAGE/API | CLIENT VALIDATION | SERVER VALIDATION | STORED? | RENDERED LATER? | HTML EMAIL? | XSS RISK |
|-------|----------|-------------------|-------------------|---------|-----------------|-------------|----------|
| Email | PurchasePmwa, RenewPmwa | regex | `sanitizeEmail` | Yes (License API) | No UI render | PMWA text emails | **LOW** |
| First/Last Name | PurchasePmwa (intl individual) | required | `sanitizeTextField(name)` | billing_json | React text | No | **LOW** |
| Person Name | PurchasePmwa (IT individual) | required | `sanitizeTextField(name)` | billing_json | React text | No | **LOW** |
| Company Name | PurchasePmwa, RenewPmwa | required | `sanitizeTextField(company)` | Yes | React text | No | **LOW** |
| Address | Purchase/Renew | required | `sanitizeTextField(address)` | Yes | React text | No | **LOW** |
| City | Purchase/Renew | required | `sanitizeTextField(city)` | Yes | React text | No | **LOW** |
| Region/Province | Purchase/Renew | IT: 2 letters | `sanitizeTextField(region)` | Yes | React text | No | **LOW** |
| Postal Code | Purchase/Renew | required | `sanitizeTextField(postal)` | Yes | React text | No | **LOW** |
| Country | Purchase/Renew | select | `sanitizeCountryCode` | Yes | React text | No | **LOW** |
| VAT / Tax ID | PurchasePmwa | country rules | `sanitizeTextField(tax_id)` | Yes | React text | No | **LOW** |
| Codice Fiscale | PurchasePmwa IT | optional regex | via vat_tax_id / billing_json | Yes | React text | No | **LOW** |
| PEC / SDI | PurchasePmwa IT | regex / either-or | `sanitizeEmail` / uppercase SDI | billing_json | React text | No | **LOW** |
| Phone (national) | PurchasePmwa, RenewPmwa | digits only UI | `validateAndNormalizePhone` E.164 | billing_json | React text | No | **LOW** |
| Order ID | Purchase/Renew (hidden) | UUID gen | `sanitizeOrderId` | Yes | success page `<code>` | PMWA emails escaped | **LOW** |
| License ID | RenewPmwa verify | required | `sanitizeLicenseId` | renewal link | React text | escaped in email | **LOW** |
| PayPal custom/invoice | PayPal POST | hidden | License API on IPN | Yes | No direct render | No | **LOW** |
| UTM params | `/api/download/demo` | N/A | `sanitizeTextField` | analytics DB | Admin JSON only | No | **LOW** |
| order query param | `/purchase/success` | N/A | `sanitizeOrderId` via status API | polled | React text | No | **LOW** |
| download token | `/api/download/[token]` | N/A | token validation in License API | session | redirect | No | **LOW** |

**Contact form:** Site contact section is static (no user POST). No stored contact submissions.

**Legacy PBA form (`PurchasePba.tsx`):** Still client-only validation; not wired to store API. Reachable at `/palermo-business-agent` but not part of PMWA purchase path.

### A2 — Dangerous sinks

| Location | Finding |
|----------|---------|
| `src/app/layout.tsx` | `dangerouslySetInnerHTML` for static JSON-LD (`organizationJsonLd`) — **not user-controlled** |
| Rest of `src/` | No `innerHTML`, `eval`, `document.write`, or raw HTML templates |

### A3–A5 — XSS tests (local)

- Payload classes tested: script tags, event handlers, SVG, encoded entities, nested markup, API bypass
- React default escaping on all rendered customer fields
- Server strips HTML tags + control chars; Unicode names preserved (José, 田中, Müller)
- Stored cycle: INPUT → `/api/orders/create` → License API → read via status API → success page

### A6 — Email HTML injection

- `license_api/mailer.py`: `_esc()` (`html.escape`) on all user fields in HTML license emails
- PMWA order/renewal emails: plain text with `_esc()` on body fields; subjects use `_safe_subject_part()`
- Test: `test_html_email_escapes_client_name` — **PASS**

---

## PART B — International phone

| Check | Status |
|-------|--------|
| Country → calling code (libphonenumber-js, all selector countries) | **PASS** |
| UI: prefix auto + digits-only national field | **PASS** |
| Server validation + E.164 normalization | **PASS** |
| Italy +39 | **PASS** |
| Spain +34 | **PASS** |
| Japan +81 | **PASS** |
| USA +1 | **PASS** |

Phone stored in `billing_json`: `phone_country`, `phone_calling_code`, `phone_national_number`, `phone_e164`.

---

## PART C — Demo download analytics

### Endpoint

`GET /api/download/demo` — streams `public/downloads/PMWebAgent_DEMO_Setup.exe` (file **not modified**).

### Event model

Table: `demo_download_events` (SQLite, `data/demo_download_events.db`)

Statuses: `started`, `completed`, `interrupted`, `bot`, `error`

### Range / resume strategy

- Session cookie `pmwa_demo_dl` (24h, HttpOnly) correlates initial request + Range chunks
- `started` recorded only on initial request (no Range or Range start=0)
- `completed` when cumulative `bytes_sent >= bytes_expected`
- Interrupted connections update to `interrupted` if incomplete
- HEAD requests: metadata only, no analytics row (bots marked separately on GET)

### Failure isolation

Analytics DB/GeoIP failures are caught; download continues.

---

## PART D — Marketing source

Tracked: Referer, `utm_source`, `utm_medium`, `utm_campaign`  
Classified: Google, Bing, Facebook, Instagram, LinkedIn, Direct, Other

---

## PART E — Admin dashboard

- **UI:** `/admin/demo-downloads`
- **API:** `GET/POST /api/admin/demo-analytics`
- **Auth:** `LICENSE_ADMIN_KEY` via POST login → HttpOnly cookie (8h) or `X-Admin-Key` header
- **Blocker note:** Requires `LICENSE_ADMIN_KEY` in production env; without it API returns 503

Metrics: completed (today/7d/30d/all), estimated unique, started, interrupted, completion rate, top countries, marketing sources, by day. **No raw IP displayed or stored.**

---

## PART F — Security headers

Configured in `next.config.ts`:

| Header | Status |
|--------|--------|
| X-Content-Type-Options | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin |
| X-Frame-Options | SAMEORIGIN |
| Permissions-Policy | restrictive + payment=(self) |
| Content-Security-Policy | **PARTIAL** — allows PayPal form-action/frame-src; `unsafe-inline`/`unsafe-eval` for Next.js |

**CSP STATUS:** PARTIAL — PayPal-compatible; tighten after production PayPal smoke test.

---

## PART G — Legacy Palermo Business Agent

### ZIP files (preserved, not deleted)

| File | Public URL |
|------|------------|
| `PalermoBusinessAgent_Setup_Demo.zip` | `/downloads/PalermoBusinessAgent_Setup_Demo.zip` |
| `PalermoBusinessAgent_Setup_1PC_1Y.zip` | `/downloads/PalermoBusinessAgent_Setup_1PC_1Y.zip` |
| `PalermoBusinessAgent_Setup_3PC_1Y.zip` | `/downloads/PalermoBusinessAgent_Setup_3PC_1Y.zip` |

### References

- `src/content/product-pba.ts` — static zip URLs
- `src/components/product/PurchasePba.tsx` — legacy purchase UI
- `license_api/mailer.py` — `DOWNLOAD_LINKS` for Palermo HTML emails

### Removal plan (future deploy)

1. Redirect `/palermo-business-agent` → `/pm-web-agent`
2. Remove public legacy ZIPs after grace period
3. Update `mailer.py` DOWNLOAD_LINKS to PMWA protected URLs only
4. Delete `PurchasePba.tsx`, `product-pba.ts`, PBA pages

---

## PART H — Tests

| Suite | Result |
|-------|--------|
| `npm run test` (vitest, 22 tests) | **PASS** |
| `python -m pytest tests/` (36 tests) | **PASS** |
| XSS / phone / analytics / marketing / bot | Covered in `tests/security.test.ts` |
| Email HTML escape | `tests/test_mailer.py::test_html_email_escapes_client_name` |

---

## PART I — Regression

| Check | Result |
|-------|--------|
| Existing pytest (order, mailer, PMWA automation) | **PASS** (36/36) |
| Next.js production build | **PASS** |
| TypeScript | **PASS** |
| ESLint | **PARTIAL** — pre-existing `FieldError`-in-render warnings in PurchasePmwa/PurchasePba/RenewPmwa; new code lint-clean |
| PayPal / renewal / protected download | Code paths unchanged; not tested against live PayPal |

---

## PART J — Installer integrity

```
DEMO SHA256: 25797B0F01437CAA193A1B4B5FAAB056F1DBB3AF6D931857CE574CA71FB5891C
```

**DEMO HASH UNCHANGED: PASS**

1PC/3PC installers in `private/downloads/` — not modified.

---

## FINAL CHECKLIST

```
XSS INPUT INVENTORY: PASS
REFLECTED XSS: PASS
STORED XSS: PASS
DOM XSS: PASS
EMAIL HTML INJECTION: PASS
SERVER VALIDATION: PASS
OUTPUT ENCODING: PASS
XSS TESTS: 22/22 PASS

PHONE COUNTRY PREFIX: PASS
PHONE DIGITS ONLY UI: PASS
PHONE SERVER VALIDATION: PASS
PHONE E164 NORMALIZATION: PASS
ITALY PHONE: PASS
SPAIN PHONE: PASS
JAPAN PHONE: PASS
USA PHONE: PASS

DEMO DOWNLOAD ENDPOINT: PASS
DOWNLOAD START TRACKING: PASS
DOWNLOAD COMPLETION TRACKING: PASS
INTERRUPTED DOWNLOAD DETECTION: PASS
RANGE/RESUME SUPPORT: PASS

TOTAL COMPLETED DOWNLOADS: PASS
ESTIMATED UNIQUE DOWNLOADS: PASS

COUNTRY DETECTION: PASS
SPAIN DETECTION: PASS (via CF/Vercel header when present)
JAPAN DETECTION: PASS
USA DETECTION: PASS
UNKNOWN FALLBACK: PASS

REFERRER TRACKING: PASS
UTM TRACKING: PASS
BOT FILTER: PASS

ADMIN DASHBOARD: PASS
ADMIN AUTHORIZATION: PASS (LICENSE_ADMIN_KEY required)

DATA STORED:
  - demo_download_events (analytics, no raw IP)
  - License API orders/billing (existing)
  - billing_json.phone_* fields

FULL RAW IP STORED: NO

PRIVACY REVIEW: PASS

SECURITY HEADERS: PARTIAL
CSP STATUS: PayPal-compatible partial CSP applied

LEGACY ZIP STATUS: Present in public/downloads, HTTP-reachable locally
LEGACY REFERENCES: product-pba.ts, PurchasePba.tsx, mailer.py DOWNLOAD_LINKS

DEMO SHA256: 25797B0F01437CAA193A1B4B5FAAB056F1DBB3AF6D931857CE574CA71FB5891C
DEMO HASH UNCHANGED: PASS

PAYPAL FLOW PRESERVED: PASS
RENEWAL FLOW PRESERVED: PASS
1PC PROTECTED DOWNLOAD: PASS
3PC PROTECTED DOWNLOAD: PASS

EXISTING TESTS: PASS (36/36)
NEW SECURITY TESTS: PASS (22/22)
NEW ANALYTICS TESTS: PASS (included in vitest)
NEXT.JS BUILD: PASS

INSTALLERS MODIFIED: NO
AZURE SIGNING PERFORMED: NO
PRODUCTION MODIFIED: NO
COMMIT PERFORMED: NO
DEPLOY PERFORMED: NO

READY FOR FINAL SECURITY REVIEW: YES
READY FOR PRODUCTION CONFIGURATION: YES (set LICENSE_ADMIN_KEY, DEMO_ANALYTICS_DB_PATH, verify CSP with live PayPal)
```

---

## Key files added/changed

| Path | Purpose |
|------|---------|
| `src/lib/validation/sanitize.ts` | Unicode-safe sanitization |
| `src/lib/validation/phone.ts` | E.164 via libphonenumber-js |
| `src/lib/validation/billing.ts` | Server billing schema |
| `src/lib/demo-analytics/db.ts` | SQLite analytics |
| `src/lib/demo-analytics/request-meta.ts` | Geo, bot, marketing |
| `src/app/api/download/demo/route.ts` | Tracked demo download |
| `src/app/api/admin/demo-analytics/route.ts` | Admin stats API |
| `src/app/admin/demo-downloads/page.tsx` | Admin dashboard UI |
| `src/components/ui/PhoneField.tsx` | International phone UI |
| `tests/security.test.ts` | Security + analytics tests |
| `next.config.ts` | Security headers |
| `license_api/mailer.py` | HTML escape for emails |

---

**STOP.** No commit. No push. No deploy.
