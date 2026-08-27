import { NextResponse } from "next/server";
import {
  AUTH_FAILED_MESSAGE,
  adminCookieOptions,
  ADMIN_SESSION_COOKIE,
  clearLoginRateLimit,
  createAdminSession,
  isAdminConfigured,
  loginClientIp,
  rateLimitLogin,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin not configured" }, { status: 503 });
  }

  const ip = loginClientIp(request);
  const limited = rateLimitLogin(ip);
  if (!limited.ok) {
    return NextResponse.json(
      { error: AUTH_FAILED_MESSAGE },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { password?: string };
  const password = typeof body.password === "string" ? body.password : "";

  if (!verifyAdminPassword(password)) {
    // Do not log password or key
    return NextResponse.json({ error: AUTH_FAILED_MESSAGE }, { status: 401 });
  }

  clearLoginRateLimit(ip);
  const { sessionId } = createAdminSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, sessionId, adminCookieOptions());
  return res;
}
