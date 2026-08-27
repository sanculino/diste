"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Stats = {
  completed: { today: number; last7: number; last30: number; allTime: number };
  uniqueCompleted: { today: number; last7: number; last30: number; allTime: number };
  started: number;
  interrupted: number;
  completionRate: number;
  topCountries: { country_code: string; c: number }[];
  topReferrers: { marketing_source: string | null; c: number }[];
  byDay: { day: string; c: number }[];
};

export function DemoDownloadsDashboard({ initialStats }: { initialStats: Stats }) {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>(initialStats);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadStats() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/demo-analytics");
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load stats");
      setStats(data as Stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function onLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Demo download analytics</h1>
          <p className="mt-2 text-sm text-slate-600">
            Completed downloads = full HTTP transfer finished by the server (not install confirmation).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => loadStats()}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => onLogout()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Log out
          </button>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-8 space-y-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Completed today" value={stats.completed.today} />
          <MetricCard title="Completed (7d)" value={stats.completed.last7} />
          <MetricCard title="Completed (30d)" value={stats.completed.last30} />
          <MetricCard title="Completed (all time)" value={stats.completed.allTime} highlight />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Est. unique today" value={stats.uniqueCompleted.today} />
          <MetricCard title="Est. unique (7d)" value={stats.uniqueCompleted.last7} />
          <MetricCard title="Est. unique (30d)" value={stats.uniqueCompleted.last30} />
          <MetricCard title="Est. unique (all time)" value={stats.uniqueCompleted.allTime} />
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <MetricCard title="Started" value={stats.started} />
          <MetricCard title="Interrupted" value={stats.interrupted} />
          <MetricCard
            title="Completion rate"
            value={`${Math.round(stats.completionRate * 100)}%`}
          />
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <TableCard title="Top countries" rows={stats.topCountries.map((r) => [r.country_code, r.c])} />
          <TableCard
            title="Marketing sources"
            rows={stats.topReferrers.map((r) => [r.marketing_source || "Unknown", r.c])}
          />
        </section>

        <TableCard title="Downloads by day" rows={stats.byDay.map((r) => [r.day, r.c])} wide />
      </div>
    </main>
  );
}

function MetricCard({
  title,
  value,
  highlight,
}: {
  title: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${highlight ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function TableCard({
  title,
  rows,
  wide,
}: {
  title: string;
  rows: [string | number, number][];
  wide?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 ${wide ? "md:col-span-2" : ""}`}>
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      <table className="mt-3 w-full text-sm">
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="py-2 text-slate-500">No data yet</td>
            </tr>
          ) : (
            rows.map(([label, count]) => (
              <tr key={String(label)} className="border-t border-slate-100">
                <td className="py-2 text-slate-700">{label}</td>
                <td className="py-2 text-right font-medium text-slate-900">{count}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
