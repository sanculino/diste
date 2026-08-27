import crypto from "crypto";

export const ADMIN_SESSION_COOKIE = "pmwa_admin_session";
export const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60 * 8; // 8 hours
export const ADMIN_COOKIE_PATH = "/";

/** Generic message — never reveal whether key was wrong vs missing. */
export const AUTH_FAILED_MESSAGE = "Authentication failed";

type RateBucket = { count: number; windowStartMs: number };

const loginAttempts = new Map<string, RateBucket>();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_ATTEMPTS = 10;

/** In-memory session store (invalidated on logout / restart). */
const activeSessions = new Map<string, number>(); // sessionId -> expiresAtMs

function adminKey(): string {
  return (process.env.LICENSE_ADMIN_KEY || "").trim();
}

function sessionSecret(): string {
  const dedicated = process.env.ADMIN_SESSION_SECRET?.trim();
  if (dedicated) return dedicated;
  const key = adminKey();
  if (key) {
    return crypto.createHmac("sha256", key).update("pmwa-admin-session-secret-v1").digest("hex");
  }
  return "";
}

export function isAdminConfigured(): boolean {
  return Boolean(adminKey() && sessionSecret());
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

export function verifyAdminPassword(password: string): boolean {
  const key = adminKey();
  if (!key || !password) return false;
  return timingSafeEqualString(password, key);
}

export function rateLimitLogin(ip: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const key = ip || "unknown";
  let bucket = loginAttempts.get(key);
  if (!bucket || now - bucket.windowStartMs > RATE_WINDOW_MS) {
    bucket = { count: 0, windowStartMs: now };
    loginAttempts.set(key, bucket);
  }
  if (bucket.count >= RATE_MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((RATE_WINDOW_MS - (now - bucket.windowStartMs)) / 1000);
    return { ok: false, retryAfterSec };
  }
  bucket.count += 1;
  return { ok: true };
}

export function clearLoginRateLimit(ip: string) {
  loginAttempts.delete(ip || "unknown");
}

export function createAdminSession(): { sessionId: string; expiresAtMs: number } {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAtMs = Date.now() + ADMIN_SESSION_MAX_AGE_SEC * 1000;
  const secret = sessionSecret();
  const sig = crypto.createHmac("sha256", secret).update(sessionId).digest("hex");
  const token = `${sessionId}.${sig}`;
  activeSessions.set(sessionId, expiresAtMs);
  return { sessionId: token, expiresAtMs };
}

export function verifyAdminSession(token: string | undefined | null): boolean {
  if (!token || !sessionSecret()) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [sessionId, sig] = parts;
  if (!sessionId || !sig || !/^[a-f0-9]{64}$/i.test(sessionId)) return false;
  const expected = crypto.createHmac("sha256", sessionSecret()).update(sessionId).digest("hex");
  if (!timingSafeEqualString(sig, expected)) return false;
  const expires = activeSessions.get(sessionId);
  if (!expires) return false;
  if (Date.now() > expires) {
    activeSessions.delete(sessionId);
    return false;
  }
  return true;
}

export function destroyAdminSession(token: string | undefined | null) {
  if (!token) return;
  const sessionId = token.split(".")[0];
  if (sessionId) activeSessions.delete(sessionId);
}

export function adminCookieOptions(maxAgeSec: number = ADMIN_SESSION_MAX_AGE_SEC) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: ADMIN_COOKIE_PATH,
    maxAge: maxAgeSec,
  };
}

/** Extract client IP for rate limiting only — respects TRUST_PROXY. */
export function loginClientIp(request: Request): string {
  if (process.env.TRUST_PROXY === "1") {
    const real = request.headers.get("x-real-ip")?.trim();
    if (real) return real.slice(0, 64);
    const xff = request.headers.get("x-forwarded-for");
    if (xff) {
      // nginx should overwrite XFF with $remote_addr — use first (only) hop
      return xff.split(",")[0]?.trim().slice(0, 64) || "unknown";
    }
  }
  return "direct";
}

/** Test helpers */
export function __resetAdminAuthForTests() {
  loginAttempts.clear();
  activeSessions.clear();
}
