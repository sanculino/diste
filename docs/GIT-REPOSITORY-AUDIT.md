# FINAL GIT / REPOSITORY AUDIT — Before Production Deploy

**Date:** 2026-08-27  
**Project:** `C:\Users\massimo\Documents\progetti\distemanagement`  
**Actions performed:** local audit only  
**NOT performed:** commit, push, deploy, VPS contact, installer changes, Azure signing

---

## UPOSTU VPS SAFETY NOTE

**PRODUCTION VPS ALSO HOSTS UPOSTU.IT.**

**UPOSTU / upostu.it RESOURCES ARE OUT OF SCOPE.**

Future deployment of `distemanagementsoftware.it` MUST NOT:

- modify UPostu source
- restart UPostu services
- modify UPostu environment
- modify UPostu database
- modify UPostu storage
- modify UPostu Nginx server block
- modify UPostu SSL certificates
- change UPostu ports
- change firewall rules affecting UPostu

Future VPS audit may use **read-only** inspection solely to identify and separate services.

---

## 1 — Git inventory

| Item | Value |
|------|--------|
| REPOSITORY ROOT | `C:/Users/massimo/Documents/progetti/distemanagement` |
| CURRENT BRANCH | `main` |
| REMOTE NAME | `origin` |
| REMOTE URL | `https://github.com/sanculino/diste.git` |
| TRACKED MODIFICATIONS | 7 (`.gitignore`, `next.config.ts`, `package.json`, `package-lock.json`, `Header.tsx`, `Progetti.tsx`, `site.ts`) |
| UNTRACKED (groups) | ~79 paths after ignore (source/docs/tests; binaries ignored where configured) |
| DELETED FILES | none |
| LAST COMMIT | `0e87a6a Fix logo size: BrandLogo component and logo-v2 cache bust` |
| Branch vs remote | up to date with `origin/main` (local work not committed) |

---

## 2 — Secret audit

| Check | Result |
|-------|--------|
| Real `.env` / `.env.local` / `.env.production` present | **NO** (only `.env.example`) |
| Real secrets already **tracked** by Git | **NO** |
| `.env.example` | Placeholders only (`change-me`, empty secrets) — OK to commit |
| `license_keys/` / `PRIVATE_KEY_DO_NOT_DISTRIBUTE` on disk | **Absent** |
| Runtime DBs on disk | Present locally (`license_api/*.db`) but **gitignored** (`*.db`) — not tracked |

### Possible secret-adjacent items (not production secrets)

| FILE | TYPE | TRACKED/UNTRACKED | ACTION REQUIRED |
|------|------|-------------------|-----------------|
| `.env.example` → `PAYPAL_BUSINESS_EMAIL=ballestrinofrancisco@gmail.com` | Public PayPal merchant email (not a password) | Untracked candidate | **REVIEW** — intentional merchant ID for WPS; optional replace with placeholder if preferred |
| `src/lib/server-config.ts` default same PayPal email | Same | Untracked | Same as above |
| `tests/*` `TEST_ED25519_HEX=...` | **Test-only** Ed25519 fixture | Untracked | **OK for tests** if confirmed ≠ production VPS key |
| `tests/test_mailer.py` `SMTP_PASSWORD=s3cret-pass` | Fake test credential | Untracked | OK |

**SECRET AUDIT: PASS**  
**REAL SECRETS TRACKED: NO**  
**REAL SECRETS IN DIFF: NO**

---

## 3 — Gitignore

Updated locally to also ignore: `*.key`, `*.p12`, `*.pfx`, `*.raw`, `license_keys/`, `*.log`, `*.sqlite*`, `data/`, `/private/`, `.vscode/`.

| Pattern | Status |
|---------|--------|
| `.env*` + `!.env.example` | PASS |
| Private installers | PASS |
| Runtime DBs | PASS |
| Keys / PEM | PASS |

**GITIGNORE: PASS** (after local strengthen)

---

## 4 — Commercial installers

| File | On disk | Git tracked | Gitignored |
|------|---------|-------------|------------|
| DEMO `PMWebAgent_DEMO_Setup.exe` | YES (~372 MB) | **NO** | YES (now via pattern / size policy — see blocker) |
| 1PC `PMWebAgent_1PC_Setup.exe` | YES (~372 MB) | **NO** | YES (`/private/`) |
| 3PC `PMWebAgent_3PC_Setup.exe` | YES (~372 MB) | **NO** | YES (`/private/`) |

**DEMO TRACKED = NO**  
**1PC TRACKED = NO**  
**3PC TRACKED = NO**

**PRIVATE INSTALLERS PUBLICLY EXPOSED: NO**  
- Served only via server route `/api/download/[token]` from `PRIVATE_INSTALLERS_DIR`  
- Next.js static hosting is `public/` only — `private/` is outside static root

### BLOCKER — binary size vs GitHub

DEMO + 3 legacy Palermo ZIPs are each **~366–372 MB**.  
GitHub rejects files **> 100 MB** without Git LFS.

**Do not `git add public/downloads/*.exe|*.zip` for a normal commit to `origin`.**

**Recommended approach:**
1. Keep installers on disk / deploy to VPS filesystem only  
2. Commit source + docs; exclude binaries from Git  
3. Optional later: Git LFS if you insist on versioning binaries

---

## 5 — Installer integrity

| Edition | SHA-256 | Match |
|---------|---------|-------|
| DEMO | `25797B0F01437CAA193A1B4B5FAAB056F1DBB3AF6D931857CE574CA71FB5891C` | **PASS** |
| 1PC | `9E3932580AACBB2203CBD79A87983A9F0795059E4FF9D2D8E7DE45B08E7267C0` | **PASS** |
| 3PC | `C5D697F35AFD11E22387E29489ADE7ACBFF4472D9BB0B221DA1F7C6B3F04A00E` | **PASS** |

**INSTALLER INTEGRITY: PASS**

---

## 6 — Database / runtime files

| Path | Class | Tracked? |
|------|-------|----------|
| `license_api/licenses.db` | DEVELOPMENT/RUNTIME local | NO (ignored) |
| `license_api/test_client.db` | TEST/DEV | NO |
| `license_api/test_client2.db` | TEST/DEV | NO |
| `data/` | RUNTIME analytics (if present) | NO (ignored) |
| `.next/dev/logs/*.log` | BUILD/DEV | NO (`.next/` ignored) |

**RUNTIME DATABASES TRACKED: NO**

---

## 7 — Legacy Palermo Business Agent

| Item | Status |
|------|--------|
| LEGACY ZIP TRACKED | **NO** (on disk under `public/downloads/`, not in Git) |
| LEGACY CODE TRACKED | **NO** yet (untracked: `product-pba.ts`, `PurchasePba.tsx`, pages, `mailer.py` links) |

### Removal plan (later deploy — do not delete now)

1. Keep ZIPs on VPS temporarily if needed for grace period  
2. Redirect `/palermo-business-agent` → `/pm-web-agent`  
3. Stop linking legacy ZIPs in `mailer.py` DOWNLOAD_LINKS  
4. Remove `PurchasePba` / `product-pba` / PBA pages after cutover  
5. Delete public legacy ZIPs after grace period

---

## 8 — Change grouping (would enter next commit)

| Group | Content |
|-------|---------|
| PMWA purchase automation | `src/app/pm-web-agent`, `purchase`, `PurchasePmwa`, APIs |
| PayPal/IPN | `src/app/api/paypal/ipn`, server-config |
| License API | `license_api/` |
| Activation / renewal | store routes, `RenewPmwa`, renewal API |
| International billing + phone | PhoneField, libphonenumber, billing validation |
| XSS/security | sanitize, billing validation, FieldError |
| Email escaping | `license_api/mailer.py` |
| DEMO analytics + admin | download/demo, admin login/dashboard, sqlite analytics |
| GeoIP/proxy prep | `geo.ts`, docs |
| Security headers | `next.config.ts` |
| Documentation | `docs/*` |
| Tests | `tests/`, vitest |
| Site chrome | Header, LanguageSwitcher, site.ts, Progetti |
| Installer references | product-pmwa demo → `/api/download/demo` |

**Anomalous / exclude:** `.vscode/`, all `*.exe`/`*.zip` installers, runtime `*.db`

---

## 9 — Final tests (re-run)

| Suite | Result |
|-------|--------|
| Vitest | **33/33 PASS** |
| Pytest | **36/36 PASS** |
| ESLint | **PASS** (0 errors / 0 warnings) |
| TypeScript | **PASS** |
| Next.js build | **PASS** |
| Installer hashes | **PASS** (all three) |

---

## 10 — Diff secret scan

No real passwords, private keys, or live SMTP credentials in proposed source diffs.  
Test fixtures and PayPal **merchant email** noted above.

---

## 11 — Commit decision

**SAFE TO COMMIT: YES** — **source/docs/tests only**  
**BLOCKERS for full tree including binaries: YES** — GitHub 100 MB limit on installers (~372 MB each)

### FILES PROPOSED FOR COMMIT

- `.gitignore`, `.env.example`
- `next.config.ts`, `package.json`, `package-lock.json`, `vitest.config.ts`
- `docs/` (all)
- `license_api/` (Python source + requirements; **not** `*.db`)
- `src/` (all new/modified app/components/lib/i18n/content)
- `tests/`
- `tools/` (scripts only — exclude any temp `_*.js` if present)
- `public/downloads/README.txt` only (if useful) — **not** the binaries

### FILES EXCLUDED FROM COMMIT

- `public/downloads/*.exe`
- `public/downloads/*.zip` (legacy Palermo)
- `private/downloads/**`
- `license_api/*.db`, `data/**`
- `.env` (none present), `.vscode/`
- `.next/`, `node_modules/`

### PROPOSED COMMIT MESSAGE

```
PM Web Agent production-ready purchase, security and analytics

Add store/PayPal/renewal flows, XSS and phone validation, demo download
analytics with secured admin session, and GeoIP/proxy prep. Exclude
commercial and oversized public installers from Git (deploy to VPS only).
```

**Await explicit authorization before `git add` / `git commit`.**  
**Do not push until after commit review.**

---

## FINAL CHECKLIST

```
REPOSITORY ROOT: C:/Users/massimo/Documents/progetti/distemanagement
CURRENT BRANCH: main
REMOTE: origin https://github.com/sanculino/diste.git

WORKTREE CLEAN: NO
MODIFIED FILES: 7
UNTRACKED FILES: ~79 (source groups; binaries ignored)

SECRET AUDIT: PASS
REAL SECRETS TRACKED: NO
REAL SECRETS IN DIFF: NO

GITIGNORE: PASS

DEMO TRACKED: NO
1PC TRACKED: NO
3PC TRACKED: NO
PRIVATE INSTALLERS PUBLICLY EXPOSED: NO

DEMO SHA256: 25797B0F01437CAA193A1B4B5FAAB056F1DBB3AF6D931857CE574CA71FB5891C
1PC SHA256: 9E3932580AACBB2203CBD79A87983A9F0795059E4FF9D2D8E7DE45B08E7267C0
3PC SHA256: C5D697F35AFD11E22387E29489ADE7ACBFF4472D9BB0B221DA1F7C6B3F04A00E
INSTALLER INTEGRITY: PASS

RUNTIME DATABASES TRACKED: NO

LEGACY ZIP TRACKED: NO
LEGACY CODE TRACKED: NO (untracked; proposed for commit as code only)

VITEST: 33/33 PASS
PYTEST: 36/36 PASS
ESLINT: PASS
TYPESCRIPT: PASS
NEXT.JS BUILD: PASS

UPOSTU VPS SAFETY NOTE ADDED: YES

SAFE TO COMMIT: YES (source only; exclude ~370MB installers)
BLOCKERS:
- Do not commit DEMO/1PC/3PC/legacy ZIP binaries to GitHub without LFS
  (each ~366–372 MB > 100 MB GitHub limit). Deploy binaries to VPS separately.

COMMIT PERFORMED: NO
PUSH PERFORMED: NO
VPS CONTACTED: NO
DEPLOY PERFORMED: NO
UPOSTU MODIFIED: NO
```

**STOP.**
