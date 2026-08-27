import crypto from "crypto";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export type DemoEventStatus = "started" | "completed" | "interrupted" | "bot" | "error";

export type DemoEventRow = {
  event_id: string;
  download_session_id: string;
  created_utc: string;
  started_utc: string | null;
  completed_utc: string | null;
  status: DemoEventStatus;
  bytes_expected: number;
  bytes_sent: number;
  country_code: string;
  country_name: string | null;
  region: string | null;
  referrer: string | null;
  referrer_domain: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  browser_family: string | null;
  os_family: string | null;
  language: string | null;
  is_bot: number;
  dedupe_identifier: string | null;
  marketing_source: string | null;
};

let dbInstance: Database.Database | null = null;

function dbPath(): string {
  const env = process.env.DEMO_ANALYTICS_DB_PATH?.trim();
  if (env) {
    // Absolute paths (e.g. /var/lib/.../demo_download_events.db) used as-is.
    if (path.isAbsolute(env)) return env;
    // Relative env paths resolve under cwd; turbopackIgnore avoids NFT whole-tree tracing.
    return path.join(/* turbopackIgnore: true */ process.cwd(), env);
  }
  // Default: scope under ./data only (never traverse outside that folder via this fallback).
  return path.join(/* turbopackIgnore: true */ process.cwd(), "data", "demo_download_events.db");
}

export function getAnalyticsDb(): Database.Database {
  if (dbInstance) return dbInstance;
  const p = dbPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  dbInstance = new Database(p);
  dbInstance.pragma("journal_mode = WAL");
  migrate(dbInstance);
  return dbInstance;
}

export function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS demo_download_events (
      event_id TEXT PRIMARY KEY,
      download_session_id TEXT NOT NULL,
      created_utc TEXT NOT NULL,
      started_utc TEXT,
      completed_utc TEXT,
      status TEXT NOT NULL,
      bytes_expected INTEGER NOT NULL DEFAULT 0,
      bytes_sent INTEGER NOT NULL DEFAULT 0,
      country_code TEXT NOT NULL DEFAULT 'UNKNOWN',
      country_name TEXT,
      region TEXT,
      referrer TEXT,
      referrer_domain TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      browser_family TEXT,
      os_family TEXT,
      language TEXT,
      is_bot INTEGER NOT NULL DEFAULT 0,
      dedupe_identifier TEXT,
      marketing_source TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_demo_dl_session ON demo_download_events(download_session_id);
    CREATE INDEX IF NOT EXISTS idx_demo_dl_status ON demo_download_events(status);
    CREATE INDEX IF NOT EXISTS idx_demo_dl_created ON demo_download_events(created_utc);
    CREATE INDEX IF NOT EXISTS idx_demo_dl_dedupe ON demo_download_events(dedupe_identifier);
  `);
}

export function newEventId(): string {
  return crypto.randomUUID();
}

export function computeDedupeId(ip: string, ua: string, secret: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHmac("sha256", secret).update(`${ip}|${ua}|${day}`).digest("hex").slice(0, 32);
}

export function insertDemoEvent(row: Omit<DemoEventRow, never>) {
  try {
    const db = getAnalyticsDb();
    db.prepare(`
      INSERT INTO demo_download_events (
        event_id, download_session_id, created_utc, started_utc, completed_utc, status,
        bytes_expected, bytes_sent, country_code, country_name, region,
        referrer, referrer_domain, utm_source, utm_medium, utm_campaign,
        browser_family, os_family, language, is_bot, dedupe_identifier, marketing_source
      ) VALUES (
        @event_id, @download_session_id, @created_utc, @started_utc, @completed_utc, @status,
        @bytes_expected, @bytes_sent, @country_code, @country_name, @region,
        @referrer, @referrer_domain, @utm_source, @utm_medium, @utm_campaign,
        @browser_family, @os_family, @language, @is_bot, @dedupe_identifier, @marketing_source
      )
    `).run(row);
  } catch {
    /* analytics failure must not block download */
  }
}

export function updateSessionProgress(
  sessionId: string,
  bytesSent: number,
  status: DemoEventStatus,
  completedUtc?: string,
) {
  try {
    const db = getAnalyticsDb();
    db.prepare(`
      UPDATE demo_download_events
      SET bytes_sent = @bytes_sent, status = @status, completed_utc = COALESCE(@completed_utc, completed_utc)
      WHERE download_session_id = @session_id AND status IN ('started', 'interrupted')
    `).run({
      session_id: sessionId,
      bytes_sent: bytesSent,
      status,
      completed_utc: completedUtc ?? null,
    });
  } catch {
    /* ignore */
  }
}

export function getSessionRow(sessionId: string): DemoEventRow | undefined {
  try {
    const db = getAnalyticsDb();
    return db.prepare(
      `SELECT * FROM demo_download_events WHERE download_session_id = ? ORDER BY created_utc DESC LIMIT 1`,
    ).get(sessionId) as DemoEventRow | undefined;
  } catch {
    return undefined;
  }
}

export function getDashboardStats() {
  try {
    const db = getAnalyticsDb();
    const now = new Date();
    const day = (d: Date) => d.toISOString();
    const ago = (days: number) => {
      const x = new Date(now);
      x.setUTCDate(x.getUTCDate() - days);
      return day(x);
    };

    const completed = (since?: string) => {
      const q = since
        ? `SELECT COUNT(*) AS c FROM demo_download_events WHERE status='completed' AND is_bot=0 AND created_utc >= ?`
        : `SELECT COUNT(*) AS c FROM demo_download_events WHERE status='completed' AND is_bot=0`;
      return since
        ? (db.prepare(q).get(since) as { c: number }).c
        : (db.prepare(q).get() as { c: number }).c;
    };

    const uniqueCompleted = (since?: string) => {
      const q = since
        ? `SELECT COUNT(DISTINCT dedupe_identifier) AS c FROM demo_download_events WHERE status='completed' AND is_bot=0 AND dedupe_identifier IS NOT NULL AND created_utc >= ?`
        : `SELECT COUNT(DISTINCT dedupe_identifier) AS c FROM demo_download_events WHERE status='completed' AND is_bot=0 AND dedupe_identifier IS NOT NULL`;
      return since
        ? (db.prepare(q).get(since) as { c: number }).c
        : (db.prepare(q).get() as { c: number }).c;
    };

    const countStatus = (status: string, since?: string) => {
      const q = since
        ? `SELECT COUNT(*) AS c FROM demo_download_events WHERE status=? AND is_bot=0 AND created_utc >= ?`
        : `SELECT COUNT(*) AS c FROM demo_download_events WHERE status=? AND is_bot=0`;
      return since
        ? (db.prepare(q).get(status, since) as { c: number }).c
        : (db.prepare(q).get(status) as { c: number }).c;
    };

    const topCountries = db.prepare(`
      SELECT country_code, COUNT(*) AS c FROM demo_download_events
      WHERE status='completed' AND is_bot=0 GROUP BY country_code ORDER BY c DESC LIMIT 15
    `).all() as { country_code: string; c: number }[];

    const topReferrers = db.prepare(`
      SELECT marketing_source, COUNT(*) AS c FROM demo_download_events
      WHERE status='completed' AND is_bot=0 GROUP BY marketing_source ORDER BY c DESC LIMIT 15
    `).all() as { marketing_source: string | null; c: number }[];

    const byDay = db.prepare(`
      SELECT substr(created_utc, 1, 10) AS day, COUNT(*) AS c FROM demo_download_events
      WHERE status='completed' AND is_bot=0 GROUP BY day ORDER BY day DESC LIMIT 30
    `).all() as { day: string; c: number }[];

    const started = countStatus("started");
    const completedAll = completed();
    const interrupted = countStatus("interrupted");
    const completionRate = started > 0 ? completedAll / started : 0;

    return {
      completed: {
        today: completed(ago(1)),
        last7: completed(ago(7)),
        last30: completed(ago(30)),
        allTime: completedAll,
      },
      uniqueCompleted: {
        today: uniqueCompleted(ago(1)),
        last7: uniqueCompleted(ago(7)),
        last30: uniqueCompleted(ago(30)),
        allTime: uniqueCompleted(),
      },
      started,
      interrupted,
      completionRate,
      topCountries,
      topReferrers,
      byDay,
    };
  } catch {
    return null;
  }
}

/** Test helper */
export function resetAnalyticsDbForTests() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  const p = dbPath();
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
