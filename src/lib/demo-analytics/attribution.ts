/**
 * First-party acquisition attribution (UTM + landing referrer).
 * Cookie is set client-side on landing; read server-side on demo download.
 * No secrets, no raw IP, no cross-site tracking.
 */

import { sanitizeTextField } from "@/lib/validation/sanitize";

export const ATTRIBUTION_COOKIE = "pmwa_attr";
export const ATTRIBUTION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

export type StoredAttribution = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  referrer_domain: string | null;
};

/** Hostnames treated as same-site (internal navigation). */
const SAME_SITE_HOSTS = new Set([
  "distemanagementsoftware.it",
  "www.distemanagementsoftware.it",
  "distemanagement.com",
  "www.distemanagement.com",
  "localhost",
  "127.0.0.1",
]);

export function isSameSiteHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (SAME_SITE_HOSTS.has(h)) return true;
  return h.endsWith(".distemanagementsoftware.it") || h.endsWith(".distemanagement.com");
}

export function extractReferrerDomain(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Parse pmwa_attr cookie from a Cookie header. */
export function parseAttributionCookie(cookieHeader: string | null): StoredAttribution | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${ATTRIBUTION_COOKIE}=([^;]+)`));
  if (!match?.[1]) return null;
  try {
    const raw = decodeURIComponent(match[1].trim());
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data !== "object" || data === null) return null;
    return {
      utm_source: sanitizeStored(data.us),
      utm_medium: sanitizeStored(data.um),
      utm_campaign: sanitizeStored(data.uc),
      referrer: sanitizeStored(data.rf),
      referrer_domain: sanitizeStored(data.rd),
    };
  } catch {
    return null;
  }
}

function sanitizeStored(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return sanitizeTextField(value, "generic") || null;
}

export type ClassifyInput = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer_domain: string | null;
};

/**
 * Deterministic marketing source from merged UTM + external referrer.
 * UTM fields take precedence over inferred referrer classification.
 */
export function classifyMarketingSource(input: ClassifyInput): string {
  const src = (input.utm_source || "").toLowerCase();
  const medium = (input.utm_medium || "").toLowerCase();
  const ref = (input.referrer_domain || "").toLowerCase();

  if (
    medium.includes("email") ||
    src.includes("newsletter") ||
    src.includes("mailchimp") ||
    src.includes("email")
  ) {
    return "Email";
  }

  const paidMedium = /^(cpc|ppc|paid|ads?|display|retargeting)$/.test(medium) || medium.includes("paid");
  if (paidMedium) {
    const fromSource = classifyFromToken(src);
    if (fromSource) return fromSource === "Referral" ? "Paid campaign" : fromSource;
    return "Paid campaign";
  }

  const fromUtm = classifyFromToken(src);
  if (fromUtm) return fromUtm;

  const fromRef = classifyFromReferrerDomain(ref);
  if (fromRef) return fromRef;

  if (ref) return "Referral";

  return "Direct";
}

function classifyFromToken(token: string): string | null {
  if (!token) return null;
  if (token.includes("facebook") || token === "fb" || token.includes("meta")) return "Facebook";
  if (token.includes("instagram") || token === "ig") return "Instagram";
  if (token.includes("linkedin")) return "LinkedIn";
  if (token.includes("google") || token === "gclid") return "Google";
  if (token.includes("bing") || token.includes("microsoft")) return "Bing";
  if (token.includes("twitter") || token === "x") return "X/Twitter";
  if (token.includes("youtube") || token === "yt") return "YouTube";
  if (token.includes("newsletter") || token.includes("email")) return "Email";
  return null;
}

function classifyFromReferrerDomain(domain: string): string | null {
  if (!domain) return null;
  if (domain.includes("google.")) return "Google";
  if (domain.includes("bing.com")) return "Bing";
  if (domain.includes("facebook.com") || domain.includes("fb.com") || domain.includes("fb.me")) {
    return "Facebook";
  }
  if (domain.includes("instagram.com")) return "Instagram";
  if (domain.includes("linkedin.com") || domain.includes("lnkd.in")) return "LinkedIn";
  if (domain.includes("twitter.com") || domain.includes("t.co") || domain.includes("x.com")) {
    return "X/Twitter";
  }
  if (domain.includes("youtube.com") || domain.includes("youtu.be")) return "YouTube";
  return null;
}

/** Build cookie payload for client-side storage (JSON keys abbreviated). */
export function serializeAttributionPayload(data: StoredAttribution): string {
  return JSON.stringify({
    us: data.utm_source,
    um: data.utm_medium,
    uc: data.utm_campaign,
    rf: data.referrer,
    rd: data.referrer_domain,
  });
}

/** Decide whether incoming landing data should replace an existing cookie. */
export function shouldPersistAttribution(
  existing: StoredAttribution | null,
  incoming: StoredAttribution,
): boolean {
  if (incoming.utm_source || incoming.utm_medium || incoming.utm_campaign) return true;
  if (!existing && incoming.referrer_domain) return true;
  return false;
}

/** Merge request UTM/referrer with stored first-party attribution. */
export function mergeMarketingAttribution(
  requestReferrer: string | null,
  requestUtm: { source: string | null; medium: string | null; campaign: string | null },
  stored: StoredAttribution | null,
): StoredAttribution & { marketing_source: string } {
  const reqDomain = extractReferrerDomain(requestReferrer);
  const reqExternal = reqDomain ? !isSameSiteHost(reqDomain) : false;

  const utm_source = requestUtm.source || stored?.utm_source || null;
  const utm_medium = requestUtm.medium || stored?.utm_medium || null;
  const utm_campaign = requestUtm.campaign || stored?.utm_campaign || null;

  let referrer: string | null = null;
  let referrer_domain: string | null = null;

  if (reqExternal) {
    referrer = requestReferrer;
    referrer_domain = reqDomain;
  } else if (stored?.referrer_domain) {
    referrer = stored.referrer;
    referrer_domain = stored.referrer_domain;
  } else if (reqDomain && isSameSiteHost(reqDomain)) {
    referrer = requestReferrer;
    referrer_domain = reqDomain;
  }

  const classificationDomain =
    (reqExternal ? reqDomain : null) || stored?.referrer_domain || null;

  const marketing_source = classifyMarketingSource({
    utm_source,
    utm_medium,
    utm_campaign,
    referrer_domain: classificationDomain,
  });

  return {
    utm_source,
    utm_medium,
    utm_campaign,
    referrer,
    referrer_domain,
    marketing_source,
  };
}
