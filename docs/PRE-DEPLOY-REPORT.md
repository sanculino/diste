# PM Web Agent — Pre-Deploy Completion Report

**Date:** 2026-08-26  
**Status:** Local completion — **NO production deploy**, **NO Azure signing**, **NO VPS changes**

---

## §10 Final Test Report

| Check | Result |
|-------|--------|
| ED25519 PATH COMPATIBILITY | **PASS** |
| RENEWAL UI IT | **PASS** |
| RENEWAL UI EN | **PASS** |
| RENEWAL PAYMENT FLOW | **PASS** (backend + UI; PayPal IPN same path as purchase) |
| SAME LICENSE RENEWED | **PASS** |
| NO NEW CODE ON RENEWAL | **PASS** |
| REAL CLIENT AUTO ACTIVATION 1PC | **PASS** |
| REAL CLIENT AUTO ACTIVATION 3PC | **PASS** |
| 1PC SECOND DEVICE REJECTION | **PASS** |
| 3PC FOURTH DEVICE REJECTION | **PASS** |
| ORDER → LICENSE | **PASS** |
| LICENSE → PROTECTED DOWNLOAD | **PASS** |
| DOWNLOAD → AUTO ACTIVATION | **PASS** (API + client `commercial_license.activate_by_order`) |
| PAYPAL IDEMPOTENCY | **PASS** |
| PRODUCTION ENV INVENTORY | **PASS** (see §7) |
| PAYPAL LIVE READY | **PASS** |
| SMTP READY | **PARTIAL** — infra vars documented; VPS config **UNKNOWN** |
| NEW CLIENT BUILD REQUIRED | **YES** |
| READY FOR NEW UNSIGNED TEST BUILD | **YES** |
| READY FOR AZURE SIGNED BUILD | **NO** (run unsigned PyInstaller build + client test first) |
| READY FOR PRODUCTION DEPLOY | **NO** |

---

## §1 ED25519 PATH COMPATIBILITY — PASS

`license_api/pmwa_crypto.py` now **prefers** `LICENSE_ED25519_PRIVATE_KEY_PATH` when set (32-byte raw file), with `LICENSE_ED25519_PRIVATE_KEY_HEX` as fallback only when PATH is unset.

Production VPS path preserved:

```
LICENSE_ED25519_PRIVATE_KEY_PATH=/etc/distemanagementsoftware/pmwa_ed25519_private.key
```

- No new keys generated  
- Client embedded public key unchanged  
- Test: `test_ed25519_path_preferred` in `tests/test_pmwa_automation.py`

---

## §2 RENEWAL UI — PASS

| Locale | URL |
|--------|-----|
| IT | `/pm-web-agent/rinnova` |
| EN | `/en/pm-web-agent/renew` |

**Flow:** license ID + email verification → billing → PayPal → IPN → `+365` days on same `license_id` → devices preserved → no new activation code.

**Security:**
- Public `POST /pmwa/store/renewal/check` — email must match a prior **paid** order for that `license_id`
- `POST /pmwa/store/admin/orders/create` re-validates on renewal orders
- `fulfill` re-validates eligibility before extending

**Backend renewal fulfill:** no `activation_claim_token`, no `download_token`, renewal confirmation email only.

---

## §3 Real Client Auto Activation — PASS

Script: `webagent/tools/test_client_auto_activation.py`

Run against License API with **matching Ed25519 key** (PATH or production VPS key):

```
$env:LICENSE_API_URL="http://127.0.0.1:8090"
$env:LICENSE_ADMIN_KEY="..."
python tools/test_client_auto_activation.py
```

**2026-08-26 run:** 7/7 PASS (1PC activate/validate/reject, 3PC ×3 allow + 4th reject)

Uses real `palermo_business_agent.commercial_license.activate_by_order` code path (same as PyInstaller build).

---

## §4 E2E Order Without Real PayPal — PASS

`tests/test_e2e_order_flow.py`:
- Full chain: create → fulfill (PayPal fixture) → status → download verify → activate-by-order → validate
- Idempotency: repeat fulfill → same `license_id`; duplicate txn on different order → 409
- SMTP failure does not roll back fulfillment (`email_sent: false`, order still paid)

**pytest total:** 35 passed

---

## §5 New Client Build — YES

Current signed installers in `private/downloads/` and demo in `public/downloads/` do **NOT** include activate-by-order client changes.

After all tests PASS on unsigned build:

| Edition | PyInstaller output | Replace |
|---------|-------------------|---------|
| DEMO | `PMWebAgent_DEMO_Setup.exe` | `public/downloads/` |
| 1PC | `PMWebAgent_1PC_Setup.exe` | `private/downloads/` |
| 3PC | `PMWebAgent_3PC_Setup.exe` | `private/downloads/` |

**Do not run Azure signing until unsigned client tests PASS.**

---

## §6 Release File Replacement Plan

After new build + Azure signing, replace binaries and **recalculate SHA-256** (do not reuse old hashes).

### Current installers (SUPERSEDED — pre-LOCALAPPDATA fix, 2026-08-27 morning)

These hashes are **OBSOLETE**. Current hashes: see `docs/INSTALLER-PLACEMENT-REPORT.md` and `public/downloads/README.txt`.

| File | SHA-256 (obsolete) |
|------|---------|
| `public/downloads/PMWebAgent_DEMO_Setup.exe` | `4564A72DDC54B4FE8B2D7A181FDC169B2C129A0399EAC40BF232644838FDD2B6` |
| `private/downloads/PMWebAgent_1PC_Setup.exe` | `DFB1109325CCA131F8ACD1B43BFA482A92D645DFF83CA8B2C7FEEB6287DE610C` |
| `private/downloads/PMWebAgent_3PC_Setup.exe` | `40753199A022315D56FCD20C6E6A31F07587035F977824B93329E8E6AB08CE99` |

Post-build command (Windows):

```powershell
Get-FileHash public\downloads\PMWebAgent_DEMO_Setup.exe -Algorithm SHA256
Get-FileHash private\downloads\PMWebAgent_1PC_Setup.exe -Algorithm SHA256
Get-FileHash private\downloads\PMWebAgent_3PC_Setup.exe -Algorithm SHA256
```

---

## §7 Production Environment Inventory

| Variable | Required | VPS exists | Secret | Purpose |
|----------|----------|------------|--------|---------|
| `LICENSE_API_URL` | YES | UNKNOWN | NO | Base URL for License API (site → API) |
| `LICENSE_ADMIN_KEY` | YES | UNKNOWN | YES | Admin auth for order create/fulfill/download verify |
| `LICENSE_ED25519_PRIVATE_KEY_PATH` | YES | **YES** | YES | Ed25519 signing key (32-byte raw file) — **preferred on VPS** |
| `LICENSE_ED25519_PRIVATE_KEY_HEX` | NO | NO | YES | Optional hex fallback if PATH unset |
| `LICENSE_DB_PATH` | YES | UNKNOWN | NO | SQLite path for PMWA + store orders |
| `PAYPAL_BUSINESS_EMAIL` | YES | UNKNOWN | NO | Receiver email — validated server-side on IPN |
| `PAYPAL_IPN_VERIFY_URL` | YES | UNKNOWN | NO | IPN verify endpoint (live: `https://www.paypal.com/cgi-bin/webscr`) |
| `PAYPAL_CHECKOUT_URL` | NO | UNKNOWN | NO | PayPal checkout form action (live default; sandbox override) |
| `NEXT_PUBLIC_PAYPAL_CHECKOUT_URL` | NO | UNKNOWN | NO | Client-side checkout URL for PayPal forms |
| `SITE_URL` | YES | UNKNOWN | NO | Canonical site URL (IPN notify_url, emails, returns) |
| `NEXT_PUBLIC_SITE_URL` | NO | UNKNOWN | NO | Public site origin for client-side URLs |
| `PRIVATE_INSTALLERS_DIR` | YES | UNKNOWN | NO | Path to protected 1PC/3PC `.exe` files |
| `SMTP_HOST` | YES* | UNKNOWN | NO | SMTP server hostname |
| `SMTP_PORT` | YES* | UNKNOWN | NO | SMTP port (e.g. 465) |
| `SMTP_USERNAME` | YES* | UNKNOWN | YES | SMTP auth user |
| `SMTP_PASSWORD` | YES* | UNKNOWN | YES | SMTP auth password |
| `SMTP_SECURITY` | YES* | UNKNOWN | NO | `ssl`, `starttls`, or `none` |
| `MAIL_FROM_NAME` | YES* | UNKNOWN | NO | Sender display name |
| `MAIL_FROM_ADDRESS` | YES* | UNKNOWN | NO | Sender email address |
| `MAIL_REPLY_TO` | NO | UNKNOWN | NO | Reply-To header |

\*Required for order confirmation emails; **not** required for license fulfillment (fulfill completes even if email fails).

---

## §8 PayPal Live Readiness — PASS

- Default IPN verify: `https://www.paypal.com/cgi-bin/webscr` (`PAYPAL_IPN_VERIFY_URL`)
- Default checkout: `https://www.paypal.com/cgi-bin/webscr` (`PAYPAL_CHECKOUT_URL` / `NEXT_PUBLIC_PAYPAL_CHECKOUT_URL`)
- Sandbox: set both to `https://www.sandbox.paypal.com/cgi-bin/webscr`
- `receiver_email` validated against `PAYPAL_BUSINESS_EMAIL` in `src/lib/paypal-ipn.ts`
- No sandbox hardcoded in production defaults

---

## §9 SMTP — PARTIAL

SMTP is implemented in `license_api/mailer.py`. Credentials come **only** from environment variables — none are stored in this repo.

**If SMTP is not configured on VPS before deploy:**
- Orders still fulfill and licenses are created
- `email_sent: false` on fulfill response
- Customer must use success page for download (purchase flow only; renewal has no download)

**Variables to configure:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_SECURITY`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS`, optional `MAIL_REPLY_TO`.

VPS SMTP status: **UNKNOWN** — verify on server before go-live.

---

## §11 STOP — Confirmed

- No production deploy performed  
- No VPS modifications  
- No Azure signing performed  
- Local changes + tests + this report only

---

## Next Steps (manual)

1. Build unsigned PyInstaller installers in `webagent/` (DEMO, 1PC, 3PC)
2. Re-run `webagent/tools/test_client_auto_activation.py` against staging API
3. Azure-sign new installers
4. Replace files per §6, compute new SHA-256
5. Configure SMTP on VPS if missing
6. Production deploy when ready
