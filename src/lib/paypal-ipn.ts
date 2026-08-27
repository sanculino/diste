import { paypalBusinessEmail, paypalIpnVerifyUrl, planAmounts, type PlanId } from "./server-config";

export type IpnFields = Record<string, string>;

export function parseIpnBody(raw: string): IpnFields {
  const params = new URLSearchParams(raw);
  const out: IpnFields = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export async function verifyIpnWithPayPal(rawBody: string): Promise<boolean> {
  const payload = `cmd=_notify-validate&${rawBody}`;
  const res = await fetch(paypalIpnVerifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload,
  });
  const text = (await res.text()).trim();
  return text === "VERIFIED";
}

export type IpnValidationResult =
  | { ok: true; orderId: string; plan: PlanId; txnId: string; amount: number }
  | { ok: false; reason: string };

export function validateIpnFields(fields: IpnFields): IpnValidationResult {
  const status = (fields.payment_status || "").trim();
  if (status !== "Completed") {
    return { ok: false, reason: `payment_status=${status || "missing"}` };
  }

  const currency = (fields.mc_currency || "").trim().toUpperCase();
  if (currency !== "EUR") {
    return { ok: false, reason: `mc_currency=${currency || "missing"}` };
  }

  const receiver = (fields.receiver_email || fields.business || "").trim().toLowerCase();
  if (receiver !== paypalBusinessEmail) {
    return { ok: false, reason: "receiver_email mismatch" };
  }

  const amount = parseFloat(fields.mc_gross || fields.payment_gross || "0");
  const orderId = (fields.custom || fields.invoice || "").trim();
  if (!orderId) {
    return { ok: false, reason: "missing order reference" };
  }

  const itemName = (fields.item_name || "").toLowerCase();
  let plan: PlanId | null = null;
  if (itemName.includes("3 pc") || itemName.includes("3pc")) {
    plan = "3pc";
  } else if (itemName.includes("1 pc") || itemName.includes("1pc")) {
    plan = "1pc";
  } else if (Math.abs(amount - planAmounts["3pc"]) < 0.01) {
    plan = "3pc";
  } else if (Math.abs(amount - planAmounts["1pc"]) < 0.01) {
    plan = "1pc";
  }
  if (!plan) {
    return { ok: false, reason: "unable to determine plan" };
  }

  const expected = planAmounts[plan];
  if (Math.abs(amount - expected) > 0.01) {
    return { ok: false, reason: `amount ${amount} != ${expected}` };
  }

  const txnId = (fields.txn_id || "").trim();
  if (!txnId) {
    return { ok: false, reason: "missing txn_id" };
  }

  return { ok: true, orderId, plan, txnId, amount };
}
