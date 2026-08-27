import { NextResponse } from "next/server";
import { fulfillStoreOrder } from "@/lib/license-api";
import { parseIpnBody, validateIpnFields, verifyIpnWithPayPal } from "@/lib/paypal-ipn";
import { paypalBusinessEmail } from "@/lib/server-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const raw = await request.text();
  const fields = parseIpnBody(raw);

  try {
    const verified = await verifyIpnWithPayPal(raw);
    if (!verified) {
      console.warn("[paypal-ipn] INVALID verification");
      return new NextResponse("INVALID", { status: 200 });
    }

    const validation = validateIpnFields(fields);
    if (!validation.ok) {
      console.warn("[paypal-ipn] rejected:", validation.reason, fields.txn_id);
      return new NextResponse("OK", { status: 200 });
    }

    const receiver = (fields.receiver_email || fields.business || "").trim().toLowerCase();
    if (receiver !== paypalBusinessEmail) {
      console.warn("[paypal-ipn] receiver mismatch", receiver);
      return new NextResponse("OK", { status: 200 });
    }

    await fulfillStoreOrder({
      order_id: validation.orderId,
      paypal_txn_id: validation.txnId,
      amount: validation.amount,
      currency: "EUR",
      receiver_email: receiver,
    });

    console.info("[paypal-ipn] fulfilled order", validation.orderId, validation.txnId);
    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "fulfill failed";
    if (message.includes("already") || message.includes("409")) {
      console.info("[paypal-ipn] idempotent skip:", message);
      return new NextResponse("OK", { status: 200 });
    }
    console.error("[paypal-ipn] error:", message);
    return new NextResponse("OK", { status: 200 });
  }
}
