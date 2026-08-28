import type { DemoEventRow } from "./db";

export type RangeSpan = { start: number; end: number };

export type ResolveDemoAttemptInput = {
  cookieSessionId: string | null;
  range: RangeSpan | null;
  existingRow: DemoEventRow | undefined;
};

export type ResolveDemoAttemptResult = {
  /** Attempt id written to pmwa_demo_dl and used for analytics updates. */
  sessionId: string;
  /** True when this request must insert a new analytics row. */
  shouldRecordStarted: boolean;
  /** True when sessionId was newly minted (not a Range resume of an active attempt). */
  isNewAttempt: boolean;
};

function isUuid(value: string): boolean {
  return /^[a-f0-9-]{36}$/i.test(value);
}

/**
 * Fresh initial downloads always create a new attempt.
 * Range continuations reuse the cookie only while the attempt is still `started`.
 */
export function resolveDemoAttempt(
  input: ResolveDemoAttemptInput,
  createId: () => string,
): ResolveDemoAttemptResult {
  const isFreshInitial = !input.range || input.range.start === 0;

  if (isFreshInitial) {
    return {
      sessionId: createId(),
      shouldRecordStarted: true,
      isNewAttempt: true,
    };
  }

  // Range resume (start > 0): correlate only to an active started attempt.
  const cookie = input.cookieSessionId;
  if (cookie && isUuid(cookie) && input.existingRow?.status === "started") {
    return {
      sessionId: cookie,
      shouldRecordStarted: false,
      isNewAttempt: false,
    };
  }

  // Terminal/missing cookie on a Range request — do not silently drop analytics.
  return {
    sessionId: createId(),
    shouldRecordStarted: true,
    isNewAttempt: true,
  };
}

export function readDemoSessionCookie(
  cookieHeader: string | null,
  cookieName: string,
): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${cookieName}=([^;]+)`));
  const value = match?.[1]?.trim();
  if (!value || !isUuid(value)) return null;
  return value;
}
