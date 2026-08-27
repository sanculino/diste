# FINAL SECURITY GATE — Admin Auth + Geo + ESLint

**Date:** 2026-08-27  
**Scope:** Local only — no deploy/commit/push/VPS/signing/installer changes.

---

## 1–3 — Admin dashboard security

### Previous issue
Dashboard UI asked the user to type `LICENSE_ADMIN_KEY` directly on `/admin/demo-downloads`, and API accepted raw `X-Admin-Key`. Session cookie was a **static** HMAC of a fixed string (never rotated on logout in a meaningful way beyond cookie clear).

### New design
| Piece | Implementation |
|-------|----------------|
| Login | `/admin/login` → `POST /api/admin/login` with `{ password }` |
| Verify | Server compares to `LICENSE_ADMIN_KEY` (timing-safe); **never** returned |
| Session | Random 32-byte id + HMAC signature; stored in memory until expiry/logout |
| Cookie | `pmwa_admin_session` — HttpOnly, SameSite=Strict, Secure in production, 8h |
| Dashboard | Server Component checks session → redirect to login if missing |
| API | `GET /api/admin/demo-analytics` requires valid session cookie only |
| Logout | `POST /api/admin/logout` clears cookie + invalidates server session |
| Rate limit | 10 attempts / 15 min per IP (generic "Authentication failed") |
| Logs | Password/key never logged |

### Secret exposure audit
| Check | Result |
|-------|--------|
| `NEXT_PUBLIC_LICENSE_ADMIN_KEY` | **Not present** |
| Client admin pages | No `LICENSE_ADMIN_KEY`, no localStorage/sessionStorage |
| Client bundle search | No `LICENSE_ADMIN_KEY` hits under `.next` static |
| Query string | Not used |

**Note:** The operator still *types* a password that matches the server secret (normal login). The secret is **not** embedded in JS/HTML/storage/URL.

---

## 4–8 — Country / IP / privacy

### CURRENT GEO SOURCE
1. **If `TRUSTED_PROXY_GEO=1`:** trust only configured proxy/CDN headers (`TRUSTED_GEO_HEADER`, default `x-geo-country`; optionally CF/Vercel when trust flag on).  
2. **Else if `GEOIP_DB_PATH` + MaxMind DB present + `TRUST_PROXY=1` with real IP:** local GeoLite2 Country lookup.  
3. **Else:** `UNKNOWN`.

**By default (no env flags):** client-sent `cf-ipcountry` / `x-geo-country` are **ignored** (spoofable). Result = `UNKNOWN`.

### Proxy IP
- `TRUST_PROXY=0` (default): IP headers ignored → `0.0.0.0` for dedupe/geo  
- `TRUST_PROXY=1`: prefer `X-Real-IP` (nginx must **overwrite** with `$remote_addr`)

Documented in `docs/PRODUCTION-GEO-PROXY.md`.

### Privacy
- **FULL RAW IP STORED: NO**
- IP used ephemerally for GeoIP + HMAC dedupe, then discarded

---

## 9 — ESLint FieldError

Moved `FieldError` to `src/components/ui/FieldError.tsx` and updated:
- `PurchasePmwa.tsx`
- `RenewPmwa.tsx`
- `PurchasePba.tsx`

**ESLint FINAL: PASS** (0 errors, 0 warnings)

---

## Regression results

| Suite | Result |
|-------|--------|
| Vitest | **33/33 PASS** |
| Pytest | **36/36 PASS** |
| ESLint | **PASS** |
| TypeScript / Next.js build | **PASS** |
| DEMO SHA256 | `25797B0F01437CAA193A1B4B5FAAB056F1DBB3AF6D931857CE574CA71FB5891C` **UNCHANGED** |

---

## Production variables (do not set now)

| VARIABLE | PURPOSE | SECRET | REQUIRED | HOW TO GENERATE | WHERE USED |
|----------|---------|--------|----------|-----------------|------------|
| `LICENSE_ADMIN_KEY` | Admin password + License API admin auth | YES | REQUIRED | `openssl rand -hex 32` | Server login, License API |
| `ADMIN_SESSION_SECRET` | HMAC for admin session cookies | YES | OPTIONAL (derived from admin key if unset) | `openssl rand -hex 32` | `admin-auth.ts` |
| `ANALYTICS_HMAC_SECRET` | Dedupe HMAC (prefer ≠ admin key) | YES | RECOMMENDED | `openssl rand -hex 32` | Demo download analytics |
| `DEMO_ANALYTICS_DB_PATH` | SQLite analytics path | NO | OPTIONAL | Path e.g. `/var/lib/pmwa/demo_download_events.db` | Analytics DB |
| `TRUST_PROXY` | Trust nginx `X-Real-IP` / XFF | NO | REQUIRED on VPS | Set `1` behind nginx | IP resolution |
| `TRUSTED_PROXY_GEO` | Trust proxy geo headers | NO | OPTIONAL | `1` only if nginx/CDN sets country | Geo |
| `TRUSTED_GEO_HEADER` | Header name for country | NO | OPTIONAL | Default `x-geo-country` | Geo |
| `GEOIP_DB_PATH` | Local MaxMind Country DB | NO | RECOMMENDED without CDN geo | Install GeoLite2-Country.mmdb | Local GeoIP |

---

## FINAL CHECKLIST

```
ADMIN DASHBOARD SERVER-SIDE AUTH: PASS
ADMIN API SERVER-SIDE AUTH: PASS
ADMIN LOGIN: PASS
HTTPONLY SESSION: PASS
SECURE COOKIE PRODUCTION: PASS
SESSION EXPIRATION: PASS
LOGOUT: PASS
BRUTE FORCE PROTECTION: PASS

LICENSE_ADMIN_KEY CLIENT EXPOSURE: NO
LICENSE_ADMIN_KEY IN CLIENT BUNDLE: NO
LICENSE_ADMIN_KEY IN HTML: NO
LICENSE_ADMIN_KEY IN STORAGE: NO
LICENSE_ADMIN_KEY IN URL: NO

CURRENT GEO SOURCE:
  Default: UNKNOWN (client geo headers NOT trusted).
  Optional: TRUSTED_PROXY_GEO=1 → nginx/CDN header.
  Optional: GEOIP_DB_PATH MaxMind local lookup when TRUST_PROXY=1.

COUNTRY DETECTION PRODUCTION READY: YES (with VPS config)
TRUSTED PROXY CONFIG REQUIRED: YES (TRUST_PROXY=1 + nginx overwrite)
LOCAL GEOIP REQUIRED: YES (recommended) unless CDN/nginx geo configured
UNKNOWN FALLBACK: PASS

RAW IP STORED: NO
HMAC DEDUPE: PASS

ESLINT FIELDERROR FIXED: PASS
ESLINT FINAL: PASS

VITEST: 33/33 PASS
PYTEST: 36/36 PASS
TYPESCRIPT: PASS
NEXT.JS BUILD: PASS

ADMIN SECURITY TESTS: 6/6 PASS (admin-geo suite)
ANALYTICS TESTS: PASS (security.test.ts)
PHONE TESTS: PASS
XSS TESTS: PASS

PAYPAL FLOW PRESERVED: PASS
RENEWAL PRESERVED: PASS
1PC PROTECTED DOWNLOAD PRESERVED: PASS
3PC PROTECTED DOWNLOAD PRESERVED: PASS

DEMO SHA256:
25797B0F01437CAA193A1B4B5FAAB056F1DBB3AF6D931857CE574CA71FB5891C

DEMO HASH UNCHANGED: PASS

PRODUCTION VARIABLES REQUIRED:
LICENSE_ADMIN_KEY (secret, required)
ADMIN_SESSION_SECRET (secret, optional)
ANALYTICS_HMAC_SECRET (secret, recommended)
DEMO_ANALYTICS_DB_PATH (optional)
TRUST_PROXY=1 (required on VPS)
TRUSTED_PROXY_GEO / TRUSTED_GEO_HEADER (optional)
GEOIP_DB_PATH (recommended for country)

INSTALLERS MODIFIED: NO
AZURE SIGNING PERFORMED: NO
PRODUCTION MODIFIED: NO
COMMIT PERFORMED: NO
PUSH PERFORMED: NO
DEPLOY PERFORMED: NO

READY FOR PRODUCTION CONFIGURATION: YES
BLOCKERS: NONE
```

**STOP.** No commit. No push. No deploy.
