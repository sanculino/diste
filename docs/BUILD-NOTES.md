# Build notes — reproducible Next.js production install

## Root cause (staging VPS)

`postcss.config.mjs` requires `@tailwindcss/postcss`.

Previously that package lived only in **devDependencies**.  
On the VPS, `npm ci` with production omit (`NODE_ENV=production` / `--omit=dev`) skipped it → `Cannot find module '@tailwindcss/postcss'`.

## Fix

`@tailwindcss/postcss` and `tailwindcss` are **dependencies** (required at `next build` time).

Verified: `npm ci --omit=dev` installs both packages.

## Native modules / allow-scripts

`better-sqlite3` and `sharp` (via Next) may show as **allow-scripts pending** on newer npm.

- Repo `.npmrc` sets `ignore-scripts=false` (do not globally disable scripts).
- Prefer **approving** lifecycle scripts for `better-sqlite3` and `sharp` when npm prompts.
- `better-sqlite3` also ships platform prebuilds under `node_modules/better-sqlite3/prebuilds/`; on Linux VPS prebuilds normally load even if a local Windows rebuild would need VS Build Tools.

## Turbopack NFT warning

`next build` may still warn:

`Encountered unexpected file in NFT list`  
trace: `demo-analytics/db.ts` → `/api/download/demo`

Cause: runtime `fs` + `process.cwd()` for analytics DB / demo file paths.

Mitigation applied: `/* turbopackIgnore: true */` on `path.join(process.cwd(), …)` and analytics path remains env-configurable (`DEMO_ANALYTICS_DB_PATH`).

Warning may **remain**; build still completes. Treat as informational unless NFT packaging misses a required file at runtime.

## Recommended VPS install for build

```bash
npm ci
npm run build
```

If the environment omits devDependencies by default, that is now OK for Tailwind/PostCSS because they are production dependencies.
