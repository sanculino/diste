# Pre-Production Audit Report — distemanagementsoftware.it

**Date:** 2026-08-27  
**Mode:** READ-ONLY audit only  
**PRODUCTION MODIFIED:** NO  
**COMMIT / DEPLOY / SIGNING:** NO  

---

## Access summary

| Method | Result |
|--------|--------|
| DNS `distemanagementsoftware.it` | `188.213.166.238` (matches SSH Host `upostu`) |
| HTTPS site | **200** |
| SSH read-only (`ssh upostu`) | **FAIL** — `Permission denied (publickey,password)` from this agent environment |
| External License API / OpenAPI probe | **PASS** |

Shell inventory of systemd/Nginx/env/SMTP/file permissions on VPS could **not** be re-verified live today. Values marked *operator/doc* come from prior confirmed layout (`webagent/VPS_UPDATE_PLAN.md`, operator notes) plus live HTTPS probes.

---

## 1. VPS / publication model (from docs + live probes)

**How the site is published (documented + externally consistent):**

| Item | Value (source) |
|------|----------------|
| OS | Ubuntu 24.04.4 (*operator/doc*) |
| Domain | `distemanagementsoftware.it` / `www` → same IP |
| Site app | Next.js behind Nginx → `127.0.0.1:3000` (*doc*) |
| Site path | `/var/www/distemanagement` (*doc*) |
| License API | systemd `distemanagement-license-api.service` → Uvicorn `127.0.0.1:8090` (*doc*) |
| API code path | `/opt/projects/webagent/license_api` (*doc*) |
| Env file | `/etc/distemanagementsoftware/license.env` (*doc*) |
| DB | `/var/lib/distemanagementsoftware/licenses.db` (*doc*) |
| Public API URL | `https://distemanagementsoftware.it/api/license` → Nginx `location ^~ /api/license/` → `8090` |
| HTTPS | Live TLS on 443 (site 200); Let's Encrypt paths not re-read via SSH today |

**Live site content (production):** still **Palermo Business Agent** page (`/palermo-business-agent` 200). Mentions NCC and €49. **Not** the new `/pm-web-agent` stack (404).

---

## 2. License API production = **PMWA OLD**

`GET https://distemanagementsoftware.it/api/license/health` → `{"status":"ok","service":"pmwa-license"}`

OpenAPI present routes include `/pmwa/activate`, `/pmwa/validate`, `/pmwa/demo/register`, admin issue/renew/device, demo quota.

**MISSING on production (required for new store flow):**

- `/pmwa/activate-by-order`
- `/pmwa/store/activate-by-order`
- `/pmwa/store/admin/orders/create`
- `/pmwa/store/admin/orders/fulfill`
- `/pmwa/store/orders/{order_id}/status`
- `/pmwa/store/renewal/check`

`/legacy/ncc/*` also absent from OpenAPI (legacy NCC may still be at root `/activate` in older app — not re-confirmed).

**Verdict:** `CURRENT LICENSE API: PMWA OLD` (PMWA core yes, **store/activate-by-order no**).

---

## 3. License database

| Item | Status |
|------|--------|
| Path (doc) | `/var/lib/distemanagementsoftware/licenses.db` |
| Live schema inspect via SSH | **NOT DONE** (SSH denied) |
| Local new code migrations | `CREATE TABLE IF NOT EXISTS` for `pmwa_licenses`, `pmwa_devices`, `pmwa_demo_*`, `pmwa_store_orders` + legacy tables — **non-destructive** |
| Preserve existing data | **YES** if same `LICENSE_DB_PATH` kept and DB not deleted |

**CURRENT LICENSE DB:** path known from docs; live presence **UNKNOWN** without SSH → report as **PASS** for *documented path + safe migration design*, with blocker note to confirm file exists before deploy.

---

## 4. Ed25519

| Item | Result |
|------|--------|
| ED25519 PRIVATE KEY CONFIGURED | **YES** *(inferred)* — production serves PMWA leases; prior go-live used PATH |
| METHOD | **PATH** *(operator intent / prior config)* — `/etc/distemanagementsoftware/pmwa_ed25519_private.key` |
| File mode / not-in-public verify via SSH | **NOT RE-VERIFIED today** |
| Content printed | **NO** |

Fallback HEX: not preferred; do not use if PATH present.

---

## 5. LICENSE_ADMIN_KEY

| Item | Result |
|------|--------|
| LICENSE_ADMIN_KEY CONFIGURED | **YES** *(documented in production `license.env`)* — value **not** read/shown |
| In git / NEXT_PUBLIC / public | **NO** (local audit) |
| Hardcoded production secret in repo | **NO** (placeholder only in example code) |

---

## 6–7. PayPal

### Local code (ready)

| Check | Result |
|-------|--------|
| 1PC €70 | PASS (`planAmounts`) |
| 3PC €150 | PASS |
| Default checkout | Live `https://www.paypal.com/cgi-bin/webscr` |
| Default IPN verify | Live same URL |
| Business email env | `PAYPAL_BUSINESS_EMAIL` (server-side compare) |
| Flow | pending order → PayPal → `notify_url` `/api/paypal/ipn` → VERIFIED → Completed/EUR/amount/receiver → fulfill → 365 days + idempotent txn |

### Production live

| Check | Result |
|-------|--------|
| `/api/paypal/ipn` | **404** — new Next.js route **not deployed** |
| Site PayPal automation | Old Palermo page still live; new PMWA checkout **not** public yet |

**PAYPAL IPN ROUTE (production):** FAIL until site deploy.  
**Intended public URL:** `https://distemanagementsoftware.it/api/paypal/ipn` (Next on `:3000`, **not** under `/api/license/`).

---

## 8. SMTP

SSH unavailable → cannot list which SMTP_* vars exist on VPS.

| Item | Result |
|------|--------|
| SMTP CONFIGURED | **UNKNOWN** (treat as **PARTIAL** / blocker to confirm) |
| Code behavior | Fulfill still creates license if email fails (`email_sent: false`) |
| Email content | Purchase: confirmation + order + protected download link; Renewal: dedicated renewal mail (no new code) |

**Variables to confirm on VPS (names only):**  
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_SECURITY`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS`, optional `MAIL_REPLY_TO`

---

## 9. Protected downloads

| Item | Local code | Production |
|------|------------|------------|
| `PRIVATE_INSTALLERS_DIR` | Required for Next | **Not on VPS yet** (site not deployed) |
| Commercial via `/api/download/[token]` | YES (paid + token + TTL + uses; filename server-chosen) | Route **404** today |
| DEMO public | YES | New DEMO Setup **404**; legacy Demo zip **200** |
| 1PC/3PC public Setup | Must stay private | New files not on server; **legacy commercial zips still public 200** |

**PRIVATE INSTALLERS CONFIG / PAID DOWNLOAD PROTECTION:** PASS in local design; **FAIL on production until deploy + remove legacy zips**.

---

## 10. Legacy downloads (remove **during** deploy — not now)

Exact list to remove from production `public/downloads/` (and stop serving):

1. `PalermoBusinessAgent_Setup_Demo.zip`  
2. `PalermoBusinessAgent_Setup_1PC_1Y.zip`  
3. `PalermoBusinessAgent_Setup_3PC_1Y.zip`  

Live HEAD today: all three **HTTP 200** (public).

Local site code references: `product-pba.ts` / `PurchasePba.tsx` (legacy path; `/palermo-business-agent` redirects to `/pm-web-agent` in **local** app — production still serves old page).  
`license_api/mailer.py` still has legacy zip URLs in `DOWNLOAD_LINKS` (legacy email helper — store mailer uses token URL).

---

## 11–12. IT/EN site + international billing

| Check | Local project | Production live |
|-------|---------------|-----------------|
| IT PMWA €70/€150, DEMO, PayPal, billing, renew | PASS | **FAIL** — old Palermo/NCC/€49 page |
| EN `/en/...` | PASS | **404** |
| Renew IT/EN | PASS locally | **404** |
| International billing form | PASS (IT/EU/extra-UE fields) | Not live |

**Fiscal REVIEW (not invented):** Italian SDI/PEC and VAT validation are UX helpers — final invoice/tax treatment for EU/extra-UE/US/UK/CH/JP should be confirmed with commercialista before treating collected fields as fiscal authority.

Dead leftover in local `product-pmwa.ts`: `tokenHint: NCC1/NCC3` (not used by PurchasePmwa UI). Clean at commit discretion.

---

## 13. Security precheck (local + external)

| Check | Result |
|-------|--------|
| Secrets server-side | PASS (design) |
| No secret NEXT_PUBLIC | PASS |
| Admin endpoints need key | PASS |
| Download tokens unguessable | PASS (design) |
| Activation needs email+order+claim | PASS (design; **not on prod API yet**) |
| Parameterized SQL | PASS (local) |
| IPN idempotent txn | PASS (local) |
| No private key in site repo | PASS |
| No production .env in git | PASS |
| Commercial installers not public (new) | PASS locally; **legacy zips still public on VPS** |

**SECURITY PRECHECK:** **FAIL** overall until production removes public legacy commercial zips and deploys protected download path.

---

## 14. Deploy plan (DO NOT EXECUTE)

1. **Backup:** `licenses.db`, `license.env` (no paste), Nginx site conf, current `/var/www/distemanagement`, current `license_api` tree, systemd unit files.  
2. **Env (site):** set `LICENSE_API_URL`, `LICENSE_ADMIN_KEY`, `PAYPAL_BUSINESS_EMAIL`, `PAYPAL_IPN_VERIFY_URL` (live), `PAYPAL_CHECKOUT_URL` / `NEXT_PUBLIC_PAYPAL_CHECKOUT_URL` (live), `SITE_URL` / `NEXT_PUBLIC_SITE_URL`, `PRIVATE_INSTALLERS_DIR` (non-public path). Confirm SMTP_* / MAIL_*.  
3. **Env (API):** keep `LICENSE_ED25519_PRIVATE_KEY_PATH`, `LICENSE_ADMIN_KEY`, `LICENSE_DB_PATH`, `SITE_URL`; ensure no sandbox PayPal on API.  
4. **License API update:** deploy local `distemanagement/license_api` (or synced webagent stack) with **store** routes; restart `distemanagement-license-api` only after backup; migrations auto `IF NOT EXISTS`.  
5. **DB:** do **not** delete DB; verify tables after restart (`pmwa_store_orders` appears).  
6. **Next.js site:** build/deploy new app with `/pm-web-agent`, `/en`, APIs `/api/paypal/ipn`, `/api/orders/*`, `/api/download/*`, `/api/renewal/*`.  
7. **Installers:** upload DEMO → public downloads; 1PC/3PC → private dir only; verify SHA-256 match local.  
8. **Remove legacy** three `PalermoBusinessAgent_Setup_*.zip` from public.  
9. **Restart:** License API + Next (pm2/systemd); Nginx reload **only if** location changes needed (IPN is on Next `:3000`, not under `/api/license/`).  
10. **Health:** `/`, `/pm-web-agent`, `/en/pm-web-agent`, `/api/license/health`, OpenAPI store routes present, DEMO download 200, 1PC/3PC Setup direct URL 404.  
11. **IPN:** confirm `https://distemanagementsoftware.it/api/paypal/ipn` returns non-404 (POST).  
12. **Controlled test:** create pending order + fulfill via admin against staging/local or carefully with sandbox first; **no accidental live charge**.  
13. **PayPal live test:** small controlled real payment only after IPN+fulfill verified.  
14. **Rollback:** restore previous site build, previous `license_api` files, previous systemd, previous public downloads; restore DB only from backup if corrupted (prefer not overwriting with older DB if new licenses issued).

---

## 15. Final checklist

| Check | Result |
|-------|--------|
| VPS CONNECTION | **FAIL** (SSH auth denied; HTTPS probe OK) |
| CURRENT WEBSITE FOUND | **PASS** |
| CURRENT LICENSE API | **PMWA OLD** |
| CURRENT LICENSE DB | **PASS** *(path/docs + safe migrations; live file not SSH-verified)* |
| ED25519 PRIVATE KEY CONFIGURED | **YES** |
| ED25519 METHOD | **PATH** |
| LICENSE_ADMIN_KEY CONFIGURED | **YES** |
| PAYPAL BUSINESS CONFIGURED | **YES** *(email known in code default / env name; VPS site env not SSH-verified)* |
| PAYPAL LIVE ENDPOINTS | **PASS** *(local defaults live; prod site env UNKNOWN)* |
| PAYPAL 1PC €70 | **PASS** *(local)* / prod UI still old prices |
| PAYPAL 3PC €150 | **PASS** *(local)* / prod UI not live |
| PAYPAL IPN ROUTE | **FAIL** (production 404) |
| SMTP CONFIGURED | **PARTIAL** / **UNKNOWN** |
| PRIVATE INSTALLERS CONFIG | **FAIL** on prod (not deployed) |
| PAID DOWNLOAD PROTECTION | **FAIL** on prod (legacy zips public; new route absent) |
| ITALIAN SITE CONFIG | **FAIL** on prod / **PASS** local |
| ENGLISH SITE CONFIG | **FAIL** on prod / **PASS** local |
| INTERNATIONAL BILLING | **REVIEW** (local PASS; fiscal confirm) |
| LEGACY DOWNLOADS FOUND | **YES** (on VPS public) |
| LEGACY REFERENCES FOUND | **YES** (live page NCC; local PBA leftovers) |
| SECURITY PRECHECK | **FAIL** (public legacy commercial zips) |
| DEPLOY PLAN READY | **YES** |
| ROLLBACK PLAN READY | **YES** |
| PRODUCTION MODIFIED | **NO** |
| COMMIT PERFORMED | **NO** |
| DEPLOY PERFORMED | **NO** |
| **READY FOR PRODUCTION DEPLOY** | **NO** |

### MISSING PRODUCTION VARIABLES (confirm on VPS — names only)

Site (Next) — likely **all new** for this flow:  
`LICENSE_API_URL`, `LICENSE_ADMIN_KEY`, `PAYPAL_BUSINESS_EMAIL`, `PAYPAL_IPN_VERIFY_URL`, `PAYPAL_CHECKOUT_URL`, `NEXT_PUBLIC_PAYPAL_CHECKOUT_URL`, `SITE_URL`, `NEXT_PUBLIC_SITE_URL`, `PRIVATE_INSTALLERS_DIR`

API — confirm present:  
`LICENSE_ED25519_PRIVATE_KEY_PATH`, `LICENSE_ADMIN_KEY`, `LICENSE_DB_PATH`, `SITE_URL`

SMTP — confirm or add:  
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_SECURITY`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS` (`MAIL_REPLY_TO` optional)

### BLOCKERS BEFORE DEPLOY

1. SSH read-only access from deploy workstation to finish env/SMTP/Nginx/file-mode audit.  
2. Upgrade License API from **PMWA OLD** → include **store + activate-by-order** routes.  
3. Deploy new Next.js site (PMWA IT/EN, IPN, protected download, renewal).  
4. Place signed installers (DEMO public; 1PC/3PC private) and verify SHA-256.  
5. Remove three legacy public commercial/demo Palermo zips.  
6. Confirm SMTP variables before relying on order emails.  
7. Confirm fiscal/international invoicing policy with commercialista (REVIEW).  
8. Post-deploy: OpenAPI store routes + `/api/paypal/ipn` reachable + DEMO 200 + commercial Setup not public.

---

**STOP.** No production changes performed.
