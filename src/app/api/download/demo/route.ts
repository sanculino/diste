import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import {
  getSessionRow,
  insertDemoEvent,
  newEventId,
  updateSessionProgress,
  computeDedupeId,
} from "@/lib/demo-analytics/db";
import {
  clientIpForDedupe,
  detectCountry,
  isBotUserAgent,
  parseBrowserOs,
  parseMarketing,
} from "@/lib/demo-analytics/request-meta";
import { licenseAdminKey } from "@/lib/server-config";

export const runtime = "nodejs";

const DEMO_FILENAME = "PMWebAgent_DEMO_Setup.exe";
const SESSION_COOKIE = "pmwa_demo_dl";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24h — correlate range/resume

function demoFilePath(): string {
  return path.join(process.cwd(), "public", "downloads", DEMO_FILENAME);
}

function utcNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function parseRange(rangeHeader: string | null, fileSize: number): { start: number; end: number } | null {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) return null;
  const part = rangeHeader.slice(6).split(",")[0]?.trim();
  if (!part) return null;
  const [startStr, endStr] = part.split("-");
  let start = startStr ? parseInt(startStr, 10) : NaN;
  let end = endStr ? parseInt(endStr, 10) : fileSize - 1;
  if (Number.isNaN(start)) start = fileSize - (endStr ? parseInt(endStr, 10) : 0);
  if (Number.isNaN(end) || end >= fileSize) end = fileSize - 1;
  if (start < 0 || start > end || end >= fileSize) return null;
  return { start, end };
}

function getOrCreateSessionId(request: Request): string {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (match?.[1] && /^[a-f0-9-]{36}$/i.test(match[1])) {
    return match[1];
  }
  return crypto.randomUUID();
}

function sessionCookieHeader(sessionId: string): string {
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`;
}

function recordStarted(
  request: Request,
  url: URL,
  sessionId: string,
  fileSize: number,
  isBot: boolean,
) {
  const existing = getSessionRow(sessionId);
  if (existing && existing.status !== "bot") return;

  const ua = request.headers.get("user-agent") || "";
  const geo = detectCountry(request);
  const marketing = parseMarketing(request, url);
  const { browser, os } = parseBrowserOs(ua);
  const secret =
    process.env.ANALYTICS_HMAC_SECRET?.trim() ||
    licenseAdminKey ||
    "local-dev-dedupe-secret";
  const dedupe = computeDedupeId(clientIpForDedupe(request), ua, secret);

  insertDemoEvent({
    event_id: newEventId(),
    download_session_id: sessionId,
    created_utc: utcNow(),
    started_utc: utcNow(),
    completed_utc: null,
    status: isBot ? "bot" : "started",
    bytes_expected: fileSize,
    bytes_sent: 0,
    country_code: geo.code,
    country_name: geo.name,
    region: geo.region,
    referrer: marketing.referrer,
    referrer_domain: marketing.referrer_domain,
    utm_source: marketing.utm_source,
    utm_medium: marketing.utm_medium,
    utm_campaign: marketing.utm_campaign,
    browser_family: browser,
    os_family: os,
    language: request.headers.get("accept-language")?.split(",")[0]?.trim() || null,
    is_bot: isBot ? 1 : 0,
    dedupe_identifier: dedupe,
    marketing_source: marketing.marketing_source,
  });
}

async function handleDownload(request: Request) {
  const filePath = demoFilePath();
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Demo installer not available" }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const url = new URL(request.url);
  const ua = request.headers.get("user-agent") || "";
  const isBot = isBotUserAgent(ua);
  const sessionId = getOrCreateSessionId(request);

  const range = parseRange(request.headers.get("range"), fileSize);
  const isInitial = !range || range.start === 0;

  if (isInitial) {
    recordStarted(request, url, sessionId, fileSize, isBot);
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? fileSize - 1;
  const chunkSize = end - start + 1;

  const nodeStream = fs.createReadStream(filePath, { start, end });
  let bytesSent = 0;

  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer | string) => {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        bytesSent += buf.length;
        controller.enqueue(buf);
      });
      nodeStream.on("end", () => {
        controller.close();
        if (isBot) return;
        const row = getSessionRow(sessionId);
        const prevSent = row?.bytes_sent || 0;
        const totalSent = range ? Math.max(prevSent, start + bytesSent) : bytesSent;

        if (totalSent >= fileSize) {
          updateSessionProgress(sessionId, fileSize, "completed", utcNow());
        } else {
          updateSessionProgress(sessionId, totalSent, "started");
        }
      });
      nodeStream.on("error", () => {
        if (!isBot) updateSessionProgress(sessionId, bytesSent, "interrupted");
        controller.error(new Error("stream error"));
      });
    },
    cancel() {
      nodeStream.destroy();
      if (!isBot) {
        const row = getSessionRow(sessionId);
        const sent = (row?.bytes_sent || 0) + bytesSent;
        if (sent < fileSize) updateSessionProgress(sessionId, sent, "interrupted");
      }
    },
  });

  const headers = new Headers({
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${DEMO_FILENAME}"`,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Set-Cookie": sessionCookieHeader(sessionId),
  });

  if (range) {
    headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    headers.set("Content-Length", String(chunkSize));
    return new NextResponse(webStream, { status: 206, headers });
  }

  headers.set("Content-Length", String(fileSize));
  return new NextResponse(webStream, { status: 200, headers });
}

export async function GET(request: Request) {
  return handleDownload(request);
}

export async function HEAD() {
  const filePath = demoFilePath();
  if (!fs.existsSync(filePath)) {
    return new NextResponse(null, { status: 404 });
  }
  const stat = fs.statSync(filePath);
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
    },
  });
}
