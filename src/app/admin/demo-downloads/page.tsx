import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-auth";
import { getDashboardStats } from "@/lib/demo-analytics/db";
import { DemoDownloadsDashboard } from "./Dashboard";

export const runtime = "nodejs";

export default async function DemoDownloadsAdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSession(token)) {
    redirect("/admin/login");
  }

  const stats = getDashboardStats() || {
    completed: { today: 0, last7: 0, last30: 0, allTime: 0 },
    uniqueCompleted: { today: 0, last7: 0, last30: 0, allTime: 0 },
    started: 0,
    interrupted: 0,
    completionRate: 0,
    topCountries: [],
    topReferrers: [],
    byDay: [],
  };

  return <DemoDownloadsDashboard initialStats={stats} />;
}
