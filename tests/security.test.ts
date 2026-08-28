import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  sanitizeTextField,
  sanitizeEmail,
  sanitizeOrderId,
  sanitizeLicenseId,
} from "@/lib/validation/sanitize";
import { validateAndNormalizePhone, digitsOnlyNational } from "@/lib/validation/phone";
import { validateBillingBody, validateRenewalCheckBody } from "@/lib/validation/billing";
import {
  computeDedupeId,
  getSessionRow,
  insertDemoEvent,
  newEventId,
  resetAnalyticsDbForTests,
  updateSessionProgress,
} from "@/lib/demo-analytics/db";
import { isBotUserAgent, parseMarketing } from "@/lib/demo-analytics/request-meta";

const XSS_PAYLOADS = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  "javascript:alert(1)",
  '<svg/onload=alert(1)>',
  "Mario<script>Rossi",
  "&#60;script&#62;",
];

describe("sanitize XSS payloads", () => {
  it.each(XSS_PAYLOADS.filter((p) => p.includes("<") || p.includes("onerror")))(
    "strips HTML from name: %s",
    (payload) => {
      const out = sanitizeTextField(payload, "name");
      expect(out).not.toMatch(/<script|onerror|<svg/i);
      expect(out).not.toContain("<");
    },
  );

  it("stores javascript: URL as inert plain text (React escapes on render)", () => {
    const out = sanitizeTextField("javascript:alert(1)", "name");
    expect(out).toBe("javascript:alert(1)");
  });

  it("preserves Unicode international names", () => {
    expect(sanitizeTextField("José García", "name")).toBe("José García");
    expect(sanitizeTextField("田中 太郎", "name")).toBe("田中 太郎");
    expect(sanitizeTextField("Müller ñ ø", "name")).toBe("Müller ñ ø");
  });

  it("rejects malicious emails", () => {
    expect(sanitizeEmail('"><script>@x.com')).toBe("");
    expect(sanitizeEmail("valid@example.com")).toBe("valid@example.com");
  });

  it("sanitizes order and license ids", () => {
    expect(sanitizeOrderId('<script>alert(1)</script>')).toBe("");
    expect(sanitizeOrderId("ORD-123-ABC")).toBe("ORD-123-ABC");
    expect(sanitizeLicenseId("PMWA-LIC-<script>")).toBe("");
    expect(sanitizeLicenseId("PMWA-LIC-ABC123")).toBe("PMWA-LIC-ABC123");
  });
});

describe("phone validation", () => {
  it("Italy +39", () => {
    const r = validateAndNormalizePhone("IT", "3331234567");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.phone.phone_e164).toBe("+393331234567");
  });

  it("Spain +34", () => {
    const r = validateAndNormalizePhone("ES", "612345678");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.phone.phone_calling_code).toBe("+34");
  });

  it("Japan +81", () => {
    const r = validateAndNormalizePhone("JP", "9012345678");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.phone.phone_e164.startsWith("+81")).toBe(true);
  });

  it("USA +1", () => {
    const r = validateAndNormalizePhone("US", "4155552671");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.phone.phone_e164).toBe("+14155552671");
  });

  it("digits only normalization on paste", () => {
    expect(digitsOnlyNational("+39 333-123-4567")).toBe("393331234567");
  });

  it("rejects letters via server validation", () => {
    const r = validateAndNormalizePhone("IT", "abc<script>");
    expect(r.ok).toBe(false);
  });

  it("rejects API bypass with HTML in phone", () => {
    const body = {
      order_id: "ORD-TEST-001",
      plan: "1pc" as const,
      customer_email: "test@example.com",
      billing_name: "Test User",
      billing_address: "Via Roma 1",
      city: "Milano",
      postal_code: "20100",
      country: "IT",
      phone_country: "IT",
      phone_national_number: "<img onerror=alert(1)>333",
    };
    const v = validateBillingBody(body);
    expect(v.ok).toBe(false);
  });
});

describe("billing body validation", () => {
  it("accepts valid billing with phone", () => {
    const v = validateBillingBody({
      order_id: "550e8400-e29b-41d4-a716-446655440000",
      plan: "1pc",
      customer_email: "buyer@example.com",
      billing_name: "Acme S.r.l.",
      billing_address: "Via Garibaldi 10",
      city: "Palermo",
      postal_code: "90100",
      country: "IT",
      phone_country: "IT",
      phone_national_number: "3331234567",
    });
    expect(v.ok).toBe(true);
  });

  it("rejects XSS in company name", () => {
    const v = validateBillingBody({
      order_id: "550e8400-e29b-41d4-a716-446655440000",
      plan: "1pc",
      customer_email: "buyer@example.com",
      company_name: '<script>alert("x")</script>Acme',
      billing_name: "Acme",
      billing_address: "Via Garibaldi 10",
      city: "Palermo",
      postal_code: "90100",
      country: "IT",
      phone_country: "IT",
      phone_national_number: "3331234567",
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.data.company_name).not.toContain("<script>");
      expect(v.data.company_name).toBe('alert("x")Acme');
    }
  });
});

describe("renewal validation", () => {
  it("sanitizes license id and email", () => {
    const ok = validateRenewalCheckBody({
      license_id: "PMWA-LIC-ABC123",
      email: "user@example.com",
    });
    expect(ok.ok).toBe(true);

    const bad = validateRenewalCheckBody({
      license_id: '<script>alert(1)</script>',
      email: "not-an-email",
    });
    expect(bad.ok).toBe(false);
  });
});

describe("demo analytics db", () => {
  beforeEach(() => {
    process.env.DEMO_ANALYTICS_DB_PATH = path.join(
      process.cwd(),
      "data",
      "test_demo_download_events.db",
    );
    resetAnalyticsDbForTests();
  });

  afterEach(() => {
    resetAnalyticsDbForTests();
    const p = process.env.DEMO_ANALYTICS_DB_PATH;
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  });

  it("tracks started then completed", () => {
    const session = newEventId();
    insertDemoEvent({
      event_id: newEventId(),
      download_session_id: session,
      created_utc: new Date().toISOString(),
      started_utc: new Date().toISOString(),
      completed_utc: null,
      status: "started",
      bytes_expected: 1000,
      bytes_sent: 0,
      country_code: "IT",
      country_name: "Italy",
      region: null,
      referrer: "https://google.com/",
      referrer_domain: "google.com",
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      browser_family: "Chrome",
      os_family: "Windows",
      language: "it-IT",
      is_bot: 0,
      dedupe_identifier: computeDedupeId("1.2.3.4", "Mozilla/5.0", "secret"),
      marketing_source: "Google",
    });

    updateSessionProgress(session, 1000, "completed", new Date().toISOString());
    const row = getSessionRow(session);
    expect(row?.status).toBe("completed");
    expect(row?.bytes_sent).toBe(1000);
  });

  it("dedupe identifier is HMAC not raw IP", () => {
    const id = computeDedupeId("203.0.113.10", "Mozilla/5.0", "secret");
    expect(id).not.toContain("203.0.113.10");
    expect(id).toHaveLength(32);
  });
});

describe("marketing classification", () => {
  it("classifies Google, Facebook, Direct", () => {
    const google = parseMarketing(
      new Request("http://localhost/api/download/demo", { headers: { referer: "https://www.google.com/search" } }),
      new URL("http://localhost/api/download/demo"),
    );
    expect(google.marketing_source).toBe("Google");

    const facebook = parseMarketing(
      new Request("http://localhost/api/download/demo", { headers: { referer: "https://l.facebook.com/" } }),
      new URL("http://localhost/api/download/demo"),
    );
    expect(facebook.marketing_source).toBe("Facebook");

    const direct = parseMarketing(
      new Request("http://localhost/api/download/demo"),
      new URL("http://localhost/api/download/demo"),
    );
    expect(direct.marketing_source).toBe("Direct");
  });

  it("classifies same-site referer without cookie as Direct", () => {
    const meta = parseMarketing(
      new Request("http://localhost/api/download/demo", {
        headers: { referer: "https://distemanagementsoftware.it/pm-web-agent" },
      }),
      new URL("http://localhost/api/download/demo"),
    );
    expect(meta.marketing_source).toBe("Direct");
  });
});

describe("bot filter", () => {
  it("detects crawlers", () => {
    expect(isBotUserAgent("Googlebot/2.1")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 Chrome/120")).toBe(false);
  });
});
