import { sanitizeTextField } from "@/lib/validation/sanitize";
import {
  mergeMarketingAttribution,
  parseAttributionCookie,
} from "@/lib/demo-analytics/attribution";

const BOT_PATTERNS = [
  /bot/i,
  /crawl/i,
  /spider/i,
  /slurp/i,
  /monitor/i,
  /headless/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
];

export function isBotUserAgent(ua: string | null): boolean {
  if (!ua) return true;
  return BOT_PATTERNS.some((p) => p.test(ua));
}

export function parseBrowserOs(ua: string): { browser: string; os: string } {
  const u = ua || "";
  let browser = "Other";
  if (/Edg\//.test(u)) browser = "Edge";
  else if (/Chrome\//.test(u)) browser = "Chrome";
  else if (/Firefox\//.test(u)) browser = "Firefox";
  else if (/Safari\//.test(u) && !/Chrome/.test(u)) browser = "Safari";

  let os = "Other";
  if (/Windows NT/.test(u)) os = "Windows";
  else if (/Mac OS X/.test(u)) os = "macOS";
  else if (/Android/.test(u)) os = "Android";
  else if (/iPhone|iPad/.test(u)) os = "iOS";
  else if (/Linux/.test(u)) os = "Linux";

  return { browser, os };
}

export type MarketingMeta = {
  referrer: string | null;
  referrer_domain: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  marketing_source: string;
};

export function parseMarketing(request: Request, url: URL): MarketingMeta {
  const requestReferrer =
    sanitizeTextField(request.headers.get("referer"), "generic") || null;

  const requestUtm = {
    source: sanitizeTextField(url.searchParams.get("utm_source"), "generic") || null,
    medium: sanitizeTextField(url.searchParams.get("utm_medium"), "generic") || null,
    campaign: sanitizeTextField(url.searchParams.get("utm_campaign"), "generic") || null,
  };

  const stored = parseAttributionCookie(request.headers.get("cookie"));
  const merged = mergeMarketingAttribution(requestReferrer, requestUtm, stored);

  return {
    referrer: merged.referrer,
    referrer_domain: merged.referrer_domain,
    utm_source: merged.utm_source,
    utm_medium: merged.utm_medium,
    utm_campaign: merged.utm_campaign,
    marketing_source: merged.marketing_source,
  };
}

export {
  detectCountry,
  resolveClientIp,
  clientIpForDedupe,
} from "./geo";
