import fs from "fs";
import { finalizeDemoSession, getSessionRow, updateSessionBytes } from "./db";

export type DemoDownloadTracker = {
  recordChunk: (byteLength: number) => void;
  recordComplete: () => void;
  recordInterrupted: () => void;
};

export function createDemoDownloadTracker(options: {
  sessionId: string;
  fileSize: number;
  rangeStart: number | null;
  isBot: boolean;
}): DemoDownloadTracker {
  let bytesThisRequest = 0;
  let terminal = false;

  function cumulativeBytes(): number {
    const row = getSessionRow(options.sessionId);
    const prev = row?.bytes_sent ?? 0;
    if (options.rangeStart !== null) {
      return Math.max(prev, options.rangeStart + bytesThisRequest);
    }
    return bytesThisRequest;
  }

  function markTerminal(status: "completed" | "interrupted") {
    if (terminal || options.isBot) return;
    const row = getSessionRow(options.sessionId);
    if (!row || row.status === "completed" || row.status === "interrupted" || row.status === "bot") {
      terminal = true;
      return;
    }
    terminal = true;
    const sent = cumulativeBytes();
    finalizeDemoSession(options.sessionId, sent, status);
  }

  return {
    recordChunk(byteLength: number) {
      bytesThisRequest += byteLength;
    },
    recordComplete() {
      if (terminal || options.isBot) return;
      const sent = cumulativeBytes();
      if (sent >= options.fileSize) {
        markTerminal("completed");
      } else {
        updateSessionBytes(options.sessionId, sent);
      }
    },
    recordInterrupted() {
      if (terminal || options.isBot) return;
      const sent = cumulativeBytes();
      if (sent >= options.fileSize) {
        markTerminal("completed");
      } else {
        markTerminal("interrupted");
      }
    },
  };
}

const CHUNK_SIZE = 64 * 1024;

/**
 * Pull-based file stream: reads from disk only when the consumer pulls.
 * Client disconnect / AbortSignal / stream cancel stops further reads so
 * completion reflects bytes actually streamed, not disk-read-ahead.
 */
export function createPullBasedDemoFileStream(
  filePath: string,
  start: number,
  end: number,
  tracker: DemoDownloadTracker,
  abortSignal: AbortSignal,
): ReadableStream<Uint8Array> {
  let fd: number | null = null;
  let position = start;
  let closed = false;

  const closeFd = () => {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        /* ignore */
      }
      fd = null;
    }
  };

  const interrupt = () => {
    if (closed) return;
    closed = true;
    closeFd();
    tracker.recordInterrupted();
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      try {
        fd = fs.openSync(filePath, "r");
      } catch {
        closed = true;
        tracker.recordInterrupted();
        controller.error(new Error("open error"));
        return;
      }
      if (abortSignal.aborted) interrupt();
      else abortSignal.addEventListener("abort", interrupt, { once: true });
    },
    pull(controller) {
      if (closed) return;
      if (abortSignal.aborted) {
        interrupt();
        return;
      }
      if (fd === null) return;

      if (position > end) {
        closed = true;
        closeFd();
        tracker.recordComplete();
        controller.close();
        return;
      }

      const toRead = Math.min(CHUNK_SIZE, end - position + 1);
      const buf = Buffer.alloc(toRead);
      let n: number;
      try {
        n = fs.readSync(fd, buf, 0, toRead, position);
      } catch {
        closed = true;
        closeFd();
        tracker.recordInterrupted();
        controller.error(new Error("read error"));
        return;
      }

      if (n <= 0) {
        closed = true;
        closeFd();
        tracker.recordComplete();
        controller.close();
        return;
      }

      position += n;
      tracker.recordChunk(n);
      controller.enqueue(new Uint8Array(buf.subarray(0, n)));
    },
    cancel() {
      interrupt();
    },
  });
}
