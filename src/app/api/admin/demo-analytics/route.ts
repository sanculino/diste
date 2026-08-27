import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/demo-analytics/db";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSession,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${ADMIN_SESSION_COOKIE}=([^;]+)`));
  const token = match?.[1] ? decodeURIComponent(match[1]) : null;
  return verifyAdminSession(token);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const stats = getDashboardStats();
  if (!stats) {
    return NextResponse.json({ error: "Analytics unavailable" }, { status: 503 });
  }
  return NextResponse.json(stats);
}
