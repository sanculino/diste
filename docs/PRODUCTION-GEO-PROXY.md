# Production geo / proxy notes (Ubuntu 24.04 + nginx + Next.js)

Do **not** trust client-supplied `CF-IPCountry`, `X-Geo-Country`, or `X-Forwarded-For`
unless nginx (or a CDN you control) **overwrites** those headers.

## Recommended nginx snippet

```nginx
# Overwrite (do not append) — prevents client spoofing
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;

# Strip any client-sent geo headers before they reach Next.js
proxy_set_header CF-IPCountry "";
proxy_set_header X-Vercel-IP-Country "";
proxy_set_header X-Geo-Country "";
```

Then set on the Next.js host:

```
TRUST_PROXY=1
```

## Option A — Local GeoIP (preferred without CDN)

1. Install MaxMind GeoLite2-Country.mmdb on the VPS (account + license key from MaxMind; free GeoLite2).
2. Place DB e.g. `/var/lib/GeoIP/GeoLite2-Country.mmdb`
3. Set:

```
GEOIP_DB_PATH=/var/lib/GeoIP/GeoLite2-Country.mmdb
TRUST_PROXY=1
TRUSTED_PROXY_GEO=0
```

4. Schedule monthly `geoipupdate` (or equivalent) to refresh the DB.
5. If the DB file is missing, country falls back to `UNKNOWN` — download still works.

## Option B — Trusted proxy geo header

Only if nginx (or Cloudflare in front) sets country from its own GeoIP:

```nginx
# Example with nginx geoip2 module (install separately on VPS later):
# proxy_set_header X-Geo-Country $geoip2_data_country_code;
```

```
TRUST_PROXY=1
TRUSTED_PROXY_GEO=1
TRUSTED_GEO_HEADER=x-geo-country
```

## Privacy

Raw IP is used ephemerally for GeoIP + HMAC dedupe, then discarded.
`demo_download_events` must never store the full IP.
