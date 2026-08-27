import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  __resetAdminAuthForTests,
  ADMIN_SESSION_COOKIE,
  createAdminSession,
  destroyAdminSession,
  isRequestAuthorized,
  rateLimitLogin,
  sessionTokenFromCookieHeader,
  verifyAdminPassword,
  verifyAdminSession,
} from "@/lib/admin-auth";
import {
  detectCountry,
  resolveClientIp,
  __resetGeoReaderForTests,
} from "@/lib/demo-analytics/geo";

describe("admin auth", () => {
  beforeEach(() => {
    process.env.LICENSE_ADMIN_KEY = "test-admin-secret-key-32chars!!";
    process.env.ADMIN_SESSION_SECRET = "test-session-secret-32chars!!!!";
    __resetAdminAuthForTests();
  });

  afterEach(() => {
    __resetAdminAuthForTests();
  });

  it("rejects wrong password", () => {
    expect(verifyAdminPassword("wrong")).toBe(false);
  });

  it("accepts correct password without exposing key in response shape", () => {
    expect(verifyAdminPassword("test-admin-secret-key-32chars!!")).toBe(true);
  });

  it("creates and verifies session", () => {
    const { sessionId } = createAdminSession();
    expect(verifyAdminSession(sessionId)).toBe(true);
    expect(verifyAdminSession("bogus.token")).toBe(false);
    expect(verifyAdminSession(undefined)).toBe(false);
  });

  it("same cookie validates for page and API without shared in-memory create state", () => {
    // Reproduces production bug: login/API Map was not visible to Server Component.
    const { sessionId: token } = createAdminSession();
    __resetAdminAuthForTests(); // wipe process maps — HMAC session must still verify
    expect(verifyAdminSession(token)).toBe(true);

    const cookieHeader = `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`;
    expect(sessionTokenFromCookieHeader(cookieHeader)).toBe(token);
    const apiReq = new Request("http://localhost/api/admin/demo-analytics", {
      headers: { cookie: cookieHeader },
    });
    expect(isRequestAuthorized(apiReq)).toBe(true);

    // Dashboard path uses the same verifier with cookies().get().value
    expect(verifyAdminSession(token)).toBe(true);
  });

  it("no cookie is denied for API and fails page verifier", () => {
    expect(verifyAdminSession(undefined)).toBe(false);
    expect(isRequestAuthorized(new Request("http://localhost/api/admin/demo-analytics"))).toBe(
      false,
    );
  });

  it("logout invalidates session", () => {
    const { sessionId } = createAdminSession();
    expect(verifyAdminSession(sessionId)).toBe(true);
    destroyAdminSession(sessionId);
    expect(verifyAdminSession(sessionId)).toBe(false);
    const apiReq = new Request("http://localhost/api/admin/demo-analytics", {
      headers: { cookie: `${ADMIN_SESSION_COOKIE}=${sessionId}` },
    });
    expect(isRequestAuthorized(apiReq)).toBe(false);
  });

  it("rate limits repeated login attempts", () => {
    for (let i = 0; i < 10; i++) {
      expect(rateLimitLogin("203.0.113.50").ok).toBe(true);
    }
    const blocked = rateLimitLogin("203.0.113.50");
    expect(blocked.ok).toBe(false);
  });
});

describe("geo / proxy trust", () => {
  beforeEach(() => {
    delete process.env.TRUST_PROXY;
    delete process.env.TRUSTED_PROXY_GEO;
    delete process.env.GEOIP_DB_PATH;
    __resetGeoReaderForTests();
  });

  it("does not trust client geo headers by default", () => {
    const req = new Request("http://localhost/api/download/demo", {
      headers: { "cf-ipcountry": "ES", "x-geo-country": "JP" },
    });
    const geo = detectCountry(req);
    expect(geo.code).toBe("UNKNOWN");
    expect(geo.source).toBe("unknown");
  });

  it("trusts geo header only when TRUSTED_PROXY_GEO=1", () => {
    process.env.TRUSTED_PROXY_GEO = "1";
    process.env.TRUSTED_GEO_HEADER = "x-geo-country";
    const req = new Request("http://localhost/api/download/demo", {
      headers: { "x-geo-country": "ES" },
    });
    const geo = detectCountry(req);
    expect(geo.code).toBe("ES");
    expect(geo.source).toBe("trusted_proxy");
  });

  it("does not trust X-Forwarded-For without TRUST_PROXY", () => {
    const req = new Request("http://localhost/api/download/demo", {
      headers: { "x-forwarded-for": "8.8.8.8", "x-real-ip": "1.2.3.4" },
    });
    expect(resolveClientIp(req)).toBe("0.0.0.0");
  });

  it("uses X-Real-IP when TRUST_PROXY=1", () => {
    process.env.TRUST_PROXY = "1";
    const req = new Request("http://localhost/api/download/demo", {
      headers: { "x-real-ip": "203.0.113.10" },
    });
    expect(resolveClientIp(req)).toBe("203.0.113.10");
  });

  it("UNKNOWN fallback when no geo source", () => {
    const geo = detectCountry(new Request("http://localhost/api/download/demo"));
    expect(geo.code).toBe("UNKNOWN");
  });
});

describe("secret must not appear in client modules", () => {
  it("admin login page source has no LICENSE_ADMIN_KEY env read", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const login = fs.readFileSync(
      path.join(process.cwd(), "src/app/admin/login/page.tsx"),
      "utf8",
    );
    const dash = fs.readFileSync(
      path.join(process.cwd(), "src/app/admin/demo-downloads/Dashboard.tsx"),
      "utf8",
    );
    expect(login).not.toMatch(/LICENSE_ADMIN_KEY|NEXT_PUBLIC_LICENSE/);
    expect(dash).not.toMatch(/LICENSE_ADMIN_KEY|NEXT_PUBLIC_LICENSE|localStorage|sessionStorage/);
    expect(login).not.toMatch(/localStorage|sessionStorage/);
  });
});
