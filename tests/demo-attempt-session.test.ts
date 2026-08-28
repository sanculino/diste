import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  computeDedupeId,
  countDemoEvents,
  finalizeDemoSession,
  getSessionRow,
  insertDemoEvent,
  listDemoEvents,
  newEventId,
  resetAnalyticsDbForTests,
} from "@/lib/demo-analytics/db";
import {
  readDemoSessionCookie,
  resolveDemoAttempt,
} from "@/lib/demo-analytics/attempt-session";
import type { DemoEventRow } from "@/lib/demo-analytics/db";

const FILE_SIZE = 1000;

function startedRow(sessionId: string, overrides: Partial<DemoEventRow> = {}): DemoEventRow {
  return {
    event_id: newEventId(),
    download_session_id: sessionId,
    created_utc: new Date().toISOString(),
    started_utc: new Date().toISOString(),
    completed_utc: null,
    status: "started",
    bytes_expected: FILE_SIZE,
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
    ...overrides,
  };
}

describe("resolveDemoAttempt session selection", () => {
  const ids = ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"];
  let i = 0;
  const createId = () => ids[i++]!;

  beforeEach(() => {
    i = 0;
  });

  it("first initial download creates a new attempt", () => {
    const result = resolveDemoAttempt(
      { cookieSessionId: null, range: null, existingRow: undefined },
      createId,
    );
    expect(result.isNewAttempt).toBe(true);
    expect(result.shouldRecordStarted).toBe(true);
    expect(result.sessionId).toBe(ids[0]);
  });

  it("second initial GET with SAME cookie still creates a NEW attempt", () => {
    const old = "99999999-9999-9999-9999-999999999999";
    const result = resolveDemoAttempt(
      {
        cookieSessionId: old,
        range: null,
        existingRow: startedRow(old, { status: "interrupted" }),
      },
      createId,
    );
    expect(result.isNewAttempt).toBe(true);
    expect(result.shouldRecordStarted).toBe(true);
    expect(result.sessionId).not.toBe(old);
  });

  it("Range: bytes=0- is treated as fresh initial → new attempt", () => {
    const old = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    const result = resolveDemoAttempt(
      {
        cookieSessionId: old,
        range: { start: 0, end: FILE_SIZE - 1 },
        existingRow: startedRow(old, { status: "completed" }),
      },
      createId,
    );
    expect(result.isNewAttempt).toBe(true);
    expect(result.sessionId).not.toBe(old);
  });

  it("Range continuation of active started attempt reuses cookie", () => {
    const active = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    const result = resolveDemoAttempt(
      {
        cookieSessionId: active,
        range: { start: 100, end: FILE_SIZE - 1 },
        existingRow: startedRow(active, { status: "started", bytes_sent: 100 }),
      },
      createId,
    );
    expect(result.isNewAttempt).toBe(false);
    expect(result.shouldRecordStarted).toBe(false);
    expect(result.sessionId).toBe(active);
  });

  it("Range request with terminal cookie creates a new attempt", () => {
    const terminal = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    const result = resolveDemoAttempt(
      {
        cookieSessionId: terminal,
        range: { start: 50, end: FILE_SIZE - 1 },
        existingRow: startedRow(terminal, { status: "interrupted" }),
      },
      createId,
    );
    expect(result.isNewAttempt).toBe(true);
    expect(result.shouldRecordStarted).toBe(true);
    expect(result.sessionId).not.toBe(terminal);
  });

  it("Range request without cookie creates a new attempt", () => {
    const result = resolveDemoAttempt(
      { cookieSessionId: null, range: { start: 10, end: 99 }, existingRow: undefined },
      createId,
    );
    expect(result.isNewAttempt).toBe(true);
    expect(result.shouldRecordStarted).toBe(true);
  });
});

describe("readDemoSessionCookie", () => {
  it("reads valid uuid cookie", () => {
    const id = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    expect(readDemoSessionCookie(`pmwa_demo_dl=${id}; other=1`, "pmwa_demo_dl")).toBe(id);
  });

  it("rejects malformed cookie values", () => {
    expect(readDemoSessionCookie("pmwa_demo_dl=not-a-uuid", "pmwa_demo_dl")).toBeNull();
  });
});

describe("repeated download attempt tracking", () => {
  beforeEach(() => {
    process.env.DEMO_ANALYTICS_DB_PATH = path.join(
      process.cwd(),
      "data",
      "test_demo_attempt_session.db",
    );
    resetAnalyticsDbForTests();
  });

  afterEach(() => {
    resetAnalyticsDbForTests();
    const p = process.env.DEMO_ANALYTICS_DB_PATH;
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  });

  it("first download → one started row", () => {
    const session = newEventId();
    insertDemoEvent(startedRow(session));
    expect(countDemoEvents()).toBe(1);
    expect(getSessionRow(session)?.status).toBe("started");
  });

  it("complete then second initial with same cookie → two independent rows", () => {
    const first = newEventId();
    insertDemoEvent(startedRow(first));
    finalizeDemoSession(first, FILE_SIZE, "completed", new Date().toISOString());
    expect(getSessionRow(first)?.status).toBe("completed");

    // Simulate resolve for second fresh GET with same cookie
    const attempt = resolveDemoAttempt(
      {
        cookieSessionId: first,
        range: null,
        existingRow: getSessionRow(first),
      },
      () => newEventId(),
    );
    expect(attempt.isNewAttempt).toBe(true);
    insertDemoEvent(startedRow(attempt.sessionId));

    const rows = listDemoEvents();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.download_session_id === first)?.status).toBe("completed");
    expect(rows.find((r) => r.download_session_id === attempt.sessionId)?.status).toBe("started");
    expect(rows[0]!.event_id).not.toBe(rows[1]!.event_id);
  });

  it("interrupted then second fresh GET → first stays interrupted, second started", () => {
    const first = newEventId();
    insertDemoEvent(startedRow(first));
    finalizeDemoSession(first, 200, "interrupted");
    const firstStatus = getSessionRow(first)?.status;
    expect(firstStatus).toBe("interrupted");

    const attempt = resolveDemoAttempt(
      {
        cookieSessionId: first,
        range: null,
        existingRow: getSessionRow(first),
      },
      () => newEventId(),
    );
    insertDemoEvent(startedRow(attempt.sessionId));

    // First row must never be modified by the new attempt insert
    expect(getSessionRow(first)?.status).toBe("interrupted");
    expect(getSessionRow(first)?.bytes_sent).toBe(200);
    expect(getSessionRow(attempt.sessionId)?.status).toBe("started");
    expect(countDemoEvents()).toBe(2);
  });

  it("Range resume of active attempt does not insert a second row", () => {
    const active = newEventId();
    insertDemoEvent(startedRow(active, { bytes_sent: 100 }));
    const attempt = resolveDemoAttempt(
      {
        cookieSessionId: active,
        range: { start: 100, end: FILE_SIZE - 1 },
        existingRow: getSessionRow(active),
      },
      () => newEventId(),
    );
    expect(attempt.shouldRecordStarted).toBe(false);
    expect(attempt.sessionId).toBe(active);
    expect(countDemoEvents()).toBe(1);
  });

  it("Range on terminal attempt creates new row (does not disappear)", () => {
    const terminal = newEventId();
    insertDemoEvent(startedRow(terminal));
    finalizeDemoSession(terminal, FILE_SIZE, "completed", new Date().toISOString());

    const attempt = resolveDemoAttempt(
      {
        cookieSessionId: terminal,
        range: { start: 50, end: FILE_SIZE - 1 },
        existingRow: getSessionRow(terminal),
      },
      () => newEventId(),
    );
    expect(attempt.shouldRecordStarted).toBe(true);
    insertDemoEvent(startedRow(attempt.sessionId));
    expect(countDemoEvents()).toBe(2);
    expect(getSessionRow(terminal)?.status).toBe("completed");
  });

  it("same dedupe_identifier across two attempts does not suppress rows", () => {
    const dedupe = computeDedupeId("203.0.113.9", "Mozilla/5.0", "secret");
    const a = newEventId();
    const b = newEventId();
    insertDemoEvent(startedRow(a, { dedupe_identifier: dedupe }));
    insertDemoEvent(startedRow(b, { dedupe_identifier: dedupe }));
    expect(countDemoEvents()).toBe(2);
    expect(dedupe).not.toContain("203.0.113.9");
  });
});
