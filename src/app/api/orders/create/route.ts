import { NextResponse } from "next/server";
import { createStoreOrder } from "@/lib/license-api";
import { planAmounts } from "@/lib/server-config";
import { validateBillingBody } from "@/lib/validation/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = validateBillingBody(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const { data } = validated;
    const amount = planAmounts[data.plan];
    const result = await createStoreOrder({
      ...data,
      amount,
      currency: "EUR",
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Order creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
