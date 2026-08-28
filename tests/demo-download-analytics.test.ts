import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  computeDedupeId,
  finalizeDemoSession,
  getDashboardStats,
  getSessionRow,
  insertDemoEvent,
  newEventId,
  resetAnalyticsDbForTests,
  updateSessionProgress,
} from "@/lib/demo-analytics/db";
import {
  createDemoDownloadTracker,
  createPullBasedDemoFileStream,
} from "@/lib/demo-analytics/download-stream";
import {
  __resetAdminAuthForTests,
  createAdminSession,
  isRequestAuthorized,
} from "@/lib/admin-auth";

const TEST_FILE = path.join(process.cwd(), "data", "test_demo_installer.bin");
const FILE_SIZE = 256 * 1024; // 256 KiB

function insertStartedSession(sessionId: string, bytesExpected = FILE_SIZE) {
  insertDemoEvent({
    event_id: newEventId(),
    download_session_id: sessionId,
    created_utc: new Date().toISOString(),
    started_utc: new Date().toISOString(),
    completed_utc: null,
    status: "started",
    bytes_expected: bytesExpected,
    bytes_sent: 0,
    country_code: "IT",
    country_name: "Italy",
    region: null,
    referrer: null,
    referrer_domain: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    browser_family: "Chrome",
    os_family: "Windows",
    language: "it-IT",
    is_bot: 0,
    dedupe_identifier: computeDedupeId("1.2.3.4", "Mozilla/5.0", "secret"),
    marketing_source: "Direct",
  });
}

async function drainStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value?.length ?? 0;
  }
  return total;
}

describe("demo download terminal states", () => {
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

  it("new attempt is started", () => {
    const session = newEventId();
    insertStartedSession(session);
    expect(getSessionRow(session)?.status).toBe("started");
    expect(getSessionRow(session)?.bytes_sent).toBe(0);
  });

  it("full successful transfer becomes completed", async () => {
    const session = newEventId();
    insertStartedSession(session);
    finalizeDemoSession(session, FILE_SIZE, "completed", new Date().toISOString());
    const row = getSessionRow(session);
    expect(row?.status).toBe("completed");
    expect(row?.bytes_sent).toBe(FILE_SIZE);
  });

  it("partial transfer becomes interrupted", () => {
    const session = newEventId();
    insertStartedSession(session);
    finalizeDemoSession(session, FILE_SIZE / 2, "interrupted");
    const row = getSessionRow(session);
    expect(row?.status).toBe("interrupted");
    expect(row?.bytes_sent).toBe(FILE_SIZE / 2);
  });

  it("completed cannot later become interrupted", () => {
    const session = newEventId();
    insertStartedSession(session);
    finalizeDemoSession(session, FILE_SIZE, "completed", new Date().toISOString());
    finalizeDemoSession(session, 100, "interrupted");
    expect(getSessionRow(session)?.status).toBe("completed");
  });

  it("interrupted cannot later become completed", () => {
    const session = newEventId();
    insertStartedSession(session);
    finalizeDemoSession(session, 100, "interrupted");
    finalizeDemoSession(session, FILE_SIZE, "completed", new Date().toISOString());
    expect(getSessionRow(session)?.status).toBe("interrupted");
  });

  it("terminal state cannot be duplicated via updateSessionProgress", () => {
    const session = newEventId();
    insertStartedSession(session);
    updateSessionProgress(session, FILE_SIZE, "completed", new Date().toISOString());
    updateSessionProgress(session, FILE_SIZE, "completed", new Date().toISOString());
    const stats = getDashboardStats();
    expect(stats?.completed.allTime).toBe(1);
  });

  it("dashboard still counts completed downloads", () => {
    const session = newEventId();
    insertStartedSession(session);
    finalizeDemoSession(session, FILE_SIZE, "completed", new Date().toISOString());
    const stats = getDashboardStats();
    expect(stats?.completed.allTime).toBe(1);
    expect(stats?.started).toBe(0);
    expect(stats?.interrupted).toBe(0);
  });
});

describe("demo download stream tracking", () => {
  beforeEach(() => {
    process.env.DEMO_ANALYTICS_DB_PATH = path.join(
      process.cwd(),
      "data",
      "test_demo_download_stream.db",
    );
    resetAnalyticsDbForTests();
    fs.mkdirSync(path.dirname(TEST_FILE), { recursive: true });
    fs.writeFileSync(TEST_FILE, Buffer.alloc(FILE_SIZE, 0xab));
  });

  afterEach(() => {
    resetAnalyticsDbForTests();
    const dbPath = process.env.DEMO_ANALYTICS_DB_PATH;
    if (dbPath && fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
  });

  it("pull stream marks completed after full read", async () => {
    const session = newEventId();
    insertStartedSession(session);
    const tracker = createDemoDownloadTracker({
      sessionId: session,
      fileSize: FILE_SIZE,
      rangeStart: null,
      isBot: false,
    });
    const stream = createPullBasedDemoFileStream(
      TEST_FILE,
      0,
      FILE_SIZE - 1,
      tracker,
      new AbortController().signal,
    );
    const bytes = await drainStream(stream);
    expect(bytes).toBe(FILE_SIZE);
    expect(getSessionRow(session)?.status).toBe("completed");
  });

  it("stream cancel before completion marks interrupted", async () => {
    const session = newEventId();
    insertStartedSession(session);
    const tracker = createDemoDownloadTracker({
      sessionId: session,
      fileSize: FILE_SIZE,
      rangeStart: null,
      isBot: false,
    });
    const stream = createPullBasedDemoFileStream(
      TEST_FILE,
      0,
      FILE_SIZE - 1,
      tracker,
      new AbortController().signal,
    );
    const reader = stream.getReader();
    await reader.read();
    await reader.cancel();
    const row = getSessionRow(session);
    expect(row?.status).toBe("interrupted");
    expect(row!.bytes_sent).toBeGreaterThan(0);
    expect(row!.bytes_sent).toBeLessThan(FILE_SIZE);
  });

  it("abort signal before completion marks interrupted", async () => {
    const session = newEventId();
    insertStartedSession(session);
    const ac = new AbortController();
    const tracker = createDemoDownloadTracker({
      sessionId: session,
      fileSize: FILE_SIZE,
      rangeStart: null,
      isBot: false,
    });
    const stream = createPullBasedDemoFileStream(
      TEST_FILE,
      0,
      FILE_SIZE - 1,
      tracker,
      ac.signal,
    );
    const reader = stream.getReader();
    await reader.read();
    ac.abort();
    await new Promise((r) => setTimeout(r, 10));
    const row = getSessionRow(session);
    expect(row?.status).toBe("interrupted");
  });

  it("read error marks interrupted", async () => {
    const session = newEventId();
    insertStartedSession(session);
    const tracker = createDemoDownloadTracker({
      sessionId: session,
      fileSize: FILE_SIZE,
      rangeStart: null,
      isBot: false,
    });
    fs.unlinkSync(TEST_FILE);
    const stream = createPullBasedDemoFileStream(
      TEST_FILE,
      0,
      FILE_SIZE - 1,
      tracker,
      new AbortController().signal,
    );
    const reader = stream.getReader();
    await expect(reader.read()).rejects.toThrow();
    await expect(getSessionRow(session)?.status).toBe("interrupted");
  });
});

describe("admin auth regression", () => {
  beforeEach(() => {
    process.env.LICENSE_ADMIN_KEY = "test-admin-secret-key-32chars!!";
    process.env.ADMIN_SESSION_SECRET = "test-session-secret-32chars!!!!";
    __resetAdminAuthForTests();
  });

  afterEach(() => {
    __resetAdminAuthForTests();
  });

  it("admin session still authorizes analytics API", () => {
    const { sessionId } = createAdminSession();
    const req = new Request("http://localhost/api/admin/demo-analytics", {
      headers: { cookie: `pmwa_admin_session=${sessionId}` },
    });
    expect(isRequestAuthorized(req)).toBe(true);
  });
});
