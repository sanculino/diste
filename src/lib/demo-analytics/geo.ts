/**
 * Country / client-IP resolution for demo analytics.
 *
 * Trust model:
 * - Geo headers from the client are NOT trusted by default (spoofable).
 * - TRUSTED_PROXY_GEO=1: trust only headers that nginx/CDN is configured to set/overwrite.
 * - GEOIP_DB_PATH: optional local MaxMind GeoLite2-Country.mmdb lookup.
 * - Otherwise: UNKNOWN.
 *
 * Raw IP is used only ephemerally for GeoIP + HMAC dedupe, never persisted.
 */

import fs from "fs";
import { Reader, type CountryResponse } from "maxmind";

let geoReader: Reader<CountryResponse> | null | undefined;

function loadGeoReader(): Reader<CountryResponse> | null {
  if (geoReader !== undefined) return geoReader;
  const dbPath = process.env.GEOIP_DB_PATH?.trim();
  if (!dbPath || !fs.existsSync(dbPath)) {
    geoReader = null;
    return null;
  }
  try {
    const buffer = fs.readFileSync(dbPath);
    geoReader = new Reader<CountryResponse>(buffer);
    return geoReader;
  } catch {
    geoReader = null;
    return null;
  }
}

function isIpv4(ip: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
}

function isIpv6(ip: string): boolean {
  return ip.includes(":");
}

export function isValidIp(ip: string): boolean {
  return isIpv4(ip) || isIpv6(ip);
}

/** Normalize IPv4-mapped IPv6 and bracket notation for lookup. */
export function normalizeClientIp(ip: string): string {
  let value = ip.trim();
  if (value.startsWith("[") && value.endsWith("]")) {
    value = value.slice(1, -1);
  }
  const lower = value.toLowerCase();
  if (lower.startsWith("::ffff:")) {
    const mapped = value.slice(7);
    if (isIpv4(mapped)) return mapped;
  }
  return value;
}

/** Private, loopback, link-local, and unspecified addresses → no public GeoIP lookup. */
export function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = normalizeClientIp(ip);
  if (!normalized || normalized === "0.0.0.0" || normalized === "::") return true;

  if (isIpv4(normalized)) {
    const parts = normalized.split(".").map((p) => parseInt(p, 10));
    if (parts.some((p) => Number.isNaN(p) || p > 255)) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true; // multicast + reserved
    return false;
  }

  if (isIpv6(normalized)) {
    const l = normalized.toLowerCase();
    if (l === "::1") return true;
    if (l.startsWith("fe80:")) return true;
    if (l.startsWith("fc") || l.startsWith("fd")) return true;
  }

  return false;
}

/**
 * Resolve client IP for ephemeral use (GeoIP / dedupe).
 * Only trusts proxy headers when TRUST_PROXY=1 (nginx must overwrite them).
 */
export function resolveClientIp(request: Request): string {
  if (process.env.TRUST_PROXY === "1") {
    const real = request.headers.get("x-real-ip")?.trim();
    if (real && isValidIp(normalizeClientIp(real))) return normalizeClientIp(real);
    const xff = request.headers.get("x-forwarded-for")?.trim();
    if (xff) {
      for (const part of xff.split(",")) {
        const candidate = normalizeClientIp(part.trim());
        if (candidate && isValidIp(candidate) && !isPrivateOrReservedIp(candidate)) {
          return candidate;
        }
      }
      const first = normalizeClientIp(xff.split(",")[0]?.trim() || "");
      if (first && isValidIp(first)) return first;
    }
  }
  return "0.0.0.0";
}

export type GeoResult = {
  code: string;
  name: string | null;
  region: string | null;
  source: "trusted_proxy" | "local_geoip" | "unknown";
};

/**
 * Detect country. Never invents values — UNKNOWN when undetermined.
 */
export function detectCountry(request: Request): GeoResult {
  if (process.env.TRUSTED_PROXY_GEO === "1") {
    const headerName = (process.env.TRUSTED_GEO_HEADER || "x-geo-country").toLowerCase();
    const raw = request.headers.get(headerName)?.trim();
    if (raw && /^[A-Za-z]{2}$/.test(raw) && raw.toUpperCase() !== "XX") {
      const regionHeader = process.env.TRUSTED_GEO_REGION_HEADER;
      const region = regionHeader ? request.headers.get(regionHeader.toLowerCase()) : null;
      return {
        code: raw.toUpperCase(),
        name: null,
        region,
        source: "trusted_proxy",
      };
    }
    const cf = request.headers.get("cf-ipcountry")?.trim();
    if (cf && /^[A-Za-z]{2}$/.test(cf) && cf.toUpperCase() !== "XX") {
      return {
        code: cf.toUpperCase(),
        name: null,
        region: request.headers.get("cf-region"),
        source: "trusted_proxy",
      };
    }
    const vercel = request.headers.get("x-vercel-ip-country")?.trim();
    if (vercel && /^[A-Za-z]{2}$/.test(vercel)) {
      return {
        code: vercel.toUpperCase(),
        name: null,
        region: request.headers.get("x-vercel-ip-country-region"),
        source: "trusted_proxy",
      };
    }
  }

  const ip = resolveClientIp(request);
  if (ip && ip !== "0.0.0.0" && !isPrivateOrReservedIp(ip)) {
    try {
      const reader = loadGeoReader();
      if (reader) {
        const hit = reader.get(ip);
        const code = hit?.country?.iso_code;
        if (code && /^[A-Z]{2}$/i.test(code)) {
          return {
            code: code.toUpperCase(),
            name: hit?.country?.names?.en || null,
            region: null,
            source: "local_geoip",
          };
        }
      }
    } catch {
      /* fall through */
    }
  }

  return { code: "UNKNOWN", name: null, region: null, source: "unknown" };
}

export function clientIpForDedupe(request: Request): string {
  return resolveClientIp(request);
}

export function __resetGeoReaderForTests() {
  geoReader = undefined;
}

export function __setGeoReaderForTests(reader: Reader<CountryResponse> | null) {
  geoReader = reader;
}
