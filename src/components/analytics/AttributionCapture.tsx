"use client";

import { useEffect } from "react";
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE_SEC,
  extractReferrerDomain,
  isSameSiteHost,
  parseAttributionCookie,
  serializeAttributionPayload,
  shouldPersistAttribution,
  type StoredAttribution,
} from "@/lib/demo-analytics/attribution";

/**
 * Captures landing UTMs and external document.referrer into a first-party cookie
 * so demo download analytics keeps the original acquisition source.
 */
export function AttributionCapture() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const utm_source = url.searchParams.get("utm_source")?.trim() || null;
    const utm_medium = url.searchParams.get("utm_medium")?.trim() || null;
    const utm_campaign = url.searchParams.get("utm_campaign")?.trim() || null;

    let refDomain: string | null = null;
    let referrer: string | null = null;
    if (document.referrer) {
      try {
        refDomain = extractReferrerDomain(document.referrer);
        if (refDomain && !isSameSiteHost(refDomain)) {
          referrer = document.referrer.slice(0, 512);
        } else {
          refDomain = null;
        }
      } catch {
        refDomain = null;
      }
    }

    const incoming: StoredAttribution = {
      utm_source,
      utm_medium,
      utm_campaign,
      referrer,
      referrer_domain: refDomain,
    };

    const existing = parseAttributionCookie(document.cookie);
    if (!shouldPersistAttribution(existing, incoming)) return;

    const payload = serializeAttributionPayload(incoming);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(payload)}; Path=/; Max-Age=${ATTRIBUTION_MAX_AGE_SEC}; SameSite=Lax${secure}`;
  }, []);

  return null;
}
