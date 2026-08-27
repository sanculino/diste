import { sanitizeTextField } from "@/lib/validation/sanitize";

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
  const referrer = sanitizeTextField(request.headers.get("referer"), "generic") || null;
  let referrer_domain: string | null = null;
  if (referrer) {
    try {
      referrer_domain = new URL(referrer).hostname.toLowerCase();
    } catch {
      referrer_domain = null;
    }
  }

  const utm_source = sanitizeTextField(url.searchParams.get("utm_source"), "generic") || null;
  const utm_medium = sanitizeTextField(url.searchParams.get("utm_medium"), "generic") || null;
  const utm_campaign = sanitizeTextField(url.searchParams.get("utm_campaign"), "generic") || null;

  let marketing_source = "Direct";
  const ref = (referrer_domain || "").toLowerCase();
  const utm = (utm_source || "").toLowerCase();

  if (utm.includes("facebook") || ref.includes("facebook.com") || ref.includes("fb.com")) {
    marketing_source = "Facebook";
  } else if (utm.includes("instagram") || ref.includes("instagram.com")) {
    marketing_source = "Instagram";
  } else if (utm.includes("linkedin") || ref.includes("linkedin.com")) {
    marketing_source = "LinkedIn";
  } else if (utm.includes("google") || ref.includes("google.")) {
    marketing_source = "Google";
  } else if (utm.includes("bing") || ref.includes("bing.com")) {
    marketing_source = "Bing";
  } else if (referrer_domain) {
    marketing_source = "Other";
  }

  return {
    referrer,
    referrer_domain,
    utm_source,
    utm_medium,
    utm_campaign,
    marketing_source,
  };
}

// Re-export geo helpers so existing imports keep working
export {
  detectCountry,
  resolveClientIp,
  clientIpForDedupe,
} from "./geo";
