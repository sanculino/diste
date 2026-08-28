import { describe, expect, it, beforeEach } from "vitest";
import type { CountryResponse } from "maxmind";
import type { Reader } from "maxmind";
import {
  ATTRIBUTION_COOKIE,
  classifyMarketingSource,
  mergeMarketingAttribution,
  parseAttributionCookie,
  serializeAttributionPayload,
  shouldPersistAttribution,
} from "@/lib/demo-analytics/attribution";
import {
  __resetGeoReaderForTests,
  __setGeoReaderForTests,
  detectCountry,
  isPrivateOrReservedIp,
  normalizeClientIp,
  resolveClientIp,
} from "@/lib/demo-analytics/geo";
import { parseMarketing } from "@/lib/demo-analytics/request-meta";
import { computeDedupeId } from "@/lib/demo-analytics/db";

describe("client IP resolution", () => {
  beforeEach(() => {
    delete process.env.TRUST_PROXY;
    __resetGeoReaderForTests();
  });

  it("uses X-Real-IP when TRUST_PROXY=1", () => {
    process.env.TRUST_PROXY = "1";
    const req = new Request("http://localhost/api/download/demo", {
      headers: { "x-real-ip": "203.0.113.10" },
    });
    expect(resolveClientIp(req)).toBe("203.0.113.10");
  });

  it("supports IPv6 addresses", () => {
    process.env.TRUST_PROXY = "1";
    const req = new Request("http://localhost/api/download/demo", {
      headers: { "x-real-ip": "2001:db8::1" },
    });
    expect(resolveClientIp(req)).toBe("2001:db8::1");
  });

  it("normalizes IPv4-mapped IPv6", () => {
    expect(normalizeClientIp("::ffff:8.8.8.8")).toBe("8.8.8.8");
  });

  it("does not trust X-Forwarded-For without TRUST_PROXY", () => {
    const req = new Request("http://localhost/api/download/demo", {
      headers: { "x-forwarded-for": "8.8.8.8" },
    });
    expect(resolveClientIp(req)).toBe("0.0.0.0");
  });

  it("private and localhost addresses are flagged", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("10.0.0.5")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
  });
});

describe("country detection", () => {
  beforeEach(() => {
    delete process.env.TRUST_PROXY;
    delete process.env.TRUSTED_PROXY_GEO;
    delete process.env.GEOIP_DB_PATH;
    __resetGeoReaderForTests();
  });

  it("returns UNKNOWN for private IP even with GeoIP reader", () => {
    process.env.TRUST_PROXY = "1";
    const mockReader = {
      get: () => ({ country: { iso_code: "US", names: { en: "United States" } } }),
    } as unknown as Reader<CountryResponse>;
    __setGeoReaderForTests(mockReader);

    const req = new Request("http://localhost/api/download/demo", {
      headers: { "x-real-ip": "127.0.0.1" },
    });
    expect(detectCountry(req).code).toBe("UNKNOWN");
  });

  it("resolves country from GeoIP fixture", () => {
    process.env.TRUST_PROXY = "1";
    const mockReader = {
      get: (ip: string) =>
        ip === "8.8.8.8"
          ? { country: { iso_code: "US", names: { en: "United States" } } }
          : null,
    } as unknown as Reader<CountryResponse>;
    __setGeoReaderForTests(mockReader);

    const req = new Request("http://localhost/api/download/demo", {
      headers: { "x-real-ip": "8.8.8.8" },
    });
    const geo = detectCountry(req);
    expect(geo.code).toBe("US");
    expect(geo.name).toBe("United States");
    expect(geo.source).toBe("local_geoip");
  });

  it("degrades to UNKNOWN when GeoIP DB unavailable", () => {
    process.env.TRUST_PROXY = "1";
    const req = new Request("http://localhost/api/download/demo", {
      headers: { "x-real-ip": "8.8.8.8" },
    });
    expect(detectCountry(req).code).toBe("UNKNOWN");
  });

  it("does not persist raw IP in dedupe HMAC", () => {
    const ip = "203.0.113.55";
    const id = computeDedupeId(ip, "Mozilla/5.0", "secret");
    expect(id).not.toContain(ip);
    expect(id).toHaveLength(32);
  });
});

describe("marketing classification", () => {
  it("classifies utm_source=facebook as Facebook", () => {
    expect(
      classifyMarketingSource({
        utm_source: "facebook",
        utm_medium: null,
        utm_campaign: null,
        referrer_domain: null,
      }),
    ).toBe("Facebook");
  });

  it("classifies utm_medium=email as Email", () => {
    expect(
      classifyMarketingSource({
        utm_source: "newsletter",
        utm_medium: "email",
        utm_campaign: null,
        referrer_domain: null,
      }),
    ).toBe("Email");
  });

  it("classifies Google external referrer", () => {
    expect(
      classifyMarketingSource({
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        referrer_domain: "www.google.com",
      }),
    ).toBe("Google");
  });

  it("classifies Instagram external referrer", () => {
    expect(
      classifyMarketingSource({
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        referrer_domain: "l.instagram.com",
      }),
    ).toBe("Instagram");
  });

  it("classifies arbitrary external site as Referral", () => {
    expect(
      classifyMarketingSource({
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        referrer_domain: "partner.example.org",
      }),
    ).toBe("Referral");
  });

  it("classifies no UTM/referrer as Direct", () => {
    expect(
      classifyMarketingSource({
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        referrer_domain: null,
      }),
    ).toBe("Direct");
  });

  it("UTM takes precedence over referrer", () => {
    expect(
      classifyMarketingSource({
        utm_source: "facebook",
        utm_medium: "cpc",
        utm_campaign: null,
        referrer_domain: "www.google.com",
      }),
    ).toBe("Facebook");
  });
});

describe("first-party attribution persistence", () => {
  it("parses attribution cookie", () => {
    const payload = serializeAttributionPayload({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "spring",
      referrer: "https://www.google.com/",
      referrer_domain: "www.google.com",
    });
    const cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(payload)}`;
    const parsed = parseAttributionCookie(cookie);
    expect(parsed?.utm_source).toBe("google");
    expect(parsed?.referrer_domain).toBe("www.google.com");
  });

  it("persists external acquisition across same-site download", () => {
    const payload = serializeAttributionPayload({
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      referrer: "https://www.google.com/search?q=test",
      referrer_domain: "www.google.com",
    });
    const cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(payload)}`;
    const req = new Request("https://distemanagementsoftware.it/api/download/demo", {
      headers: {
        referer: "https://distemanagementsoftware.it/pm-web-agent",
        cookie,
      },
    });
    const meta = parseMarketing(req, new URL(req.url));
    expect(meta.marketing_source).toBe("Google");
    expect(meta.referrer_domain).toBe("www.google.com");
  });

  it("same-site download referer does not overwrite stored Google source", () => {
    const payload = serializeAttributionPayload({
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      referrer: "https://www.google.com/",
      referrer_domain: "www.google.com",
    });
    const cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(payload)}`;
    const merged = mergeMarketingAttribution(
      "https://distemanagementsoftware.it/pm-web-agent",
      { source: null, medium: null, campaign: null },
      parseAttributionCookie(cookie),
    );
    expect(merged.marketing_source).toBe("Google");
  });

  it("same-site download without cookie is Direct not Referral", () => {
    const req = new Request("https://distemanagementsoftware.it/api/download/demo", {
      headers: { referer: "https://distemanagementsoftware.it/pm-web-agent" },
    });
    const meta = parseMarketing(req, new URL(req.url));
    expect(meta.marketing_source).toBe("Direct");
  });

  it("shouldPersistAttribution prefers new UTMs over existing cookie", () => {
    const existing = {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      referrer: "https://www.google.com/",
      referrer_domain: "www.google.com",
    };
    const incoming = {
      utm_source: "facebook",
      utm_medium: "cpc",
      utm_campaign: null,
      referrer: null,
      referrer_domain: null,
    };
    expect(shouldPersistAttribution(existing, incoming)).toBe(true);
  });
});
