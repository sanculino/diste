import { NextResponse } from "next/server";
import { getStoreOrderStatus, getStoreOrderAdmin } from "@/lib/license-api";
import { validateOrderStatusParam } from "@/lib/validation/billing";

export const runtime = "nodejs";

type Params = { params: Promise<{ orderId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { orderId: rawOrderId } = await params;
  const validated = validateOrderStatusParam(rawOrderId);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const orderId = validated.order_id;

  try {
    const publicStatus = await getStoreOrderStatus(orderId);
    if (publicStatus.payment_status !== "paid") {
      return NextResponse.json({
        ...publicStatus,
        paid: false,
      });
    }

    let activation_claim_token: string | undefined;
    let download_token: string | undefined;
    try {
      const admin = await getStoreOrderAdmin(orderId);
      activation_claim_token = admin.activation_claim_token;
      download_token = admin.download_token;
    } catch {
      /* admin secrets optional for polling */
    }

    return NextResponse.json({
      ...publicStatus,
      paid: true,
      is_renewal: publicStatus.is_renewal,
      activation_claim_token,
      download_token,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not found";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
