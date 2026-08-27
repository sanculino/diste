import { licenseAdminKey, licenseApiUrl } from "./server-config";

async function adminFetch(path: string, init?: RequestInit) {
  if (!licenseAdminKey) {
    throw new Error("LICENSE_ADMIN_KEY is not configured");
  }
  const res = await fetch(`${licenseApiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": licenseAdminKey,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : `License API error ${res.status}`,
    );
  }
  return data;
}

export type CreateOrderPayload = {
  order_id: string;
  plan: "1pc" | "3pc";
  customer_email: string;
  customer_type: string;
  company_name?: string;
  billing_name?: string;
  billing_address?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  country?: string;
  vat_tax_id?: string;
  billing_json?: Record<string, unknown>;
  amount: number;
  currency: string;
  is_renewal?: boolean;
  renewal_license_id?: string;
};

export async function createStoreOrder(payload: CreateOrderPayload) {
  return adminFetch("/pmwa/store/admin/orders/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fulfillStoreOrder(payload: {
  order_id: string;
  paypal_txn_id: string;
  amount: number;
  currency: string;
  receiver_email?: string;
}) {
  return adminFetch("/pmwa/store/admin/orders/fulfill", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getStoreOrderStatus(orderId: string) {
  const res = await fetch(`${licenseApiUrl}/pmwa/store/orders/${encodeURIComponent(orderId)}/status`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : "Order not found");
  }
  return data as {
    order_id: string;
    plan: string;
    payment_status: string;
    customer_email: string;
    license_id?: string;
    paid_at?: string;
    is_renewal?: boolean;
    renewal_license_id?: string;
  };
}

export async function checkRenewalEligibility(licenseId: string, email: string) {
  const res = await fetch(`${licenseApiUrl}/pmwa/store/renewal/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ license_id: licenseId, email }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : "Renewal check failed");
  }
  return data as {
    eligible: boolean;
    license_id: string;
    plan: "1pc" | "3pc";
    amount: number;
    expires_utc: string;
    max_devices: number;
  };
}

export async function getStoreOrderAdmin(orderId: string) {
  return adminFetch(`/pmwa/store/admin/orders/${encodeURIComponent(orderId)}`);
}

export async function verifyDownloadToken(downloadToken: string) {
  return adminFetch("/pmwa/store/admin/downloads/verify", {
    method: "POST",
    body: JSON.stringify({ download_token: downloadToken }),
  }) as Promise<{ ok: boolean; filename: string; plan: string; order_id: string }>;
}
