import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/demo-analytics/db";
import { isRequestAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const stats = getDashboardStats();
  if (!stats) {
    return NextResponse.json({ error: "Analytics unavailable" }, { status: 503 });
  }
  return NextResponse.json(stats);
}
