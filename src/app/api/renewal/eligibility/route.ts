import { NextResponse } from "next/server";
import { checkRenewalEligibility } from "@/lib/license-api";
import { validateRenewalCheckBody } from "@/lib/validation/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = validateRenewalCheckBody(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const result = await checkRenewalEligibility(validated.license_id, validated.email);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Renewal check failed";
    const status = message.includes("403") || message.toLowerCase().includes("match") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
