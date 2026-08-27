# -*- coding: utf-8 -*-
"""End-to-end order flow without real PayPal — simulates verified IPN + fulfill chain."""

from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient

TEST_ED25519_HEX = "b1d07a967608b7ae96f04fc01df3853204d3fb6281eaa3591640aade7df25ab3"
ADMIN = "test-admin-key-e2e"
FP1 = "e1" * 32


@pytest.fixture()
def env(monkeypatch, tmp_path):
    monkeypatch.setenv("LICENSE_ADMIN_KEY", ADMIN)
    monkeypatch.setenv("LICENSE_ED25519_PRIVATE_KEY_HEX", TEST_ED25519_HEX)
    monkeypatch.setenv("LICENSE_DB_PATH", str(tmp_path / "e2e.db"))
    monkeypatch.setenv("SITE_URL", "http://localhost:3000")
    return tmp_path


@pytest.fixture()
def client(env):
    import license_api.app as api

    importlib.reload(api)
    api.init_db()
    with TestClient(api.app) as c:
        yield c


def _paypal_completed_fixture(order_id: str, plan: str, txn_id: str) -> dict[str, str]:
    amount = "70.00" if plan == "1pc" else "150.00"
    item = (
        "PM Web Agent — 1 PC License / 1 year"
        if plan == "1pc"
        else "PM Web Agent — 3 PC License / 1 year"
    )
    return {
        "payment_status": "Completed",
        "mc_currency": "EUR",
        "receiver_email": "ballestrinofrancisco@gmail.com",
        "mc_gross": amount,
        "custom": order_id,
        "invoice": order_id,
        "txn_id": txn_id,
        "item_name": item,
    }


def test_full_chain_1pc_order_license_download_activate(client):
    """order create → fulfill (PayPal fixture) → license → download verify → activate-by-order."""
    c = client
    headers = {"X-Admin-Key": ADMIN}
    oid = "E2E-ORD-1PC"
    plan = "1pc"

    cr = c.post(
        "/pmwa/store/admin/orders/create",
        headers=headers,
        json={
            "order_id": oid,
            "plan": plan,
            "customer_email": "e2e@example.com",
            "customer_type": "company",
            "company_name": "E2E Co",
            "billing_address": "Via Test 1",
            "city": "Palermo",
            "postal_code": "90100",
            "country": "IT",
            "amount": 70.0,
            "currency": "EUR",
        },
    )
    assert cr.status_code == 200

    ipn = _paypal_completed_fixture(oid, plan, "E2E-TXN-1PC")
    fr = c.post(
        "/pmwa/store/admin/orders/fulfill",
        headers=headers,
        json={
            "order_id": oid,
            "paypal_txn_id": ipn["txn_id"],
            "amount": float(ipn["mc_gross"]),
            "currency": "EUR",
            "receiver_email": ipn["receiver_email"],
        },
    )
    assert fr.status_code == 200
    fulfilled = fr.json()
    assert fulfilled["payment_status"] == "paid"
    license_id = fulfilled["license_id"]
    claim = fulfilled["activation_claim_token"]
    download_token = fulfilled["download_token"]
    assert license_id.startswith("PMWA-LIC-")
    assert claim
    assert download_token

    st = c.get(f"/pmwa/store/orders/{oid}/status")
    assert st.status_code == 200
    assert st.json()["payment_status"] == "paid"

    dv = c.post(
        "/pmwa/store/admin/downloads/verify",
        headers=headers,
        json={"download_token": download_token},
    )
    assert dv.status_code == 200
    assert dv.json()["filename"] == "PMWebAgent_1PC_Setup.exe"

    act = c.post(
        "/pmwa/activate-by-order",
        json={
            "email": "e2e@example.com",
            "order_id": oid,
            "activation_claim_token": claim,
            "fingerprint_hex": FP1,
        },
    )
    assert act.status_code == 200
    assert act.json().get("lease_token")

    val = c.post(
        "/pmwa/validate",
        json={"license_id": license_id, "fingerprint_hex": FP1},
    )
    assert val.status_code == 200


def test_paypal_idempotency_no_duplicate_licenses(client):
    c = client
    headers = {"X-Admin-Key": ADMIN}
    oid = "E2E-IDEM"
    c.post(
        "/pmwa/store/admin/orders/create",
        headers=headers,
        json={
            "order_id": oid,
            "plan": "3pc",
            "customer_email": "idem@example.com",
            "customer_type": "individual",
            "amount": 150.0,
            "currency": "EUR",
        },
    )
    payload = {
        "order_id": oid,
        "paypal_txn_id": "E2E-TXN-DUP",
        "amount": 150.0,
        "currency": "EUR",
    }
    r1 = c.post("/pmwa/store/admin/orders/fulfill", headers=headers, json=payload)
    r2 = c.post("/pmwa/store/admin/orders/fulfill", headers=headers, json=payload)
    r3 = c.post("/pmwa/store/admin/orders/fulfill", headers=headers, json=payload)
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r3.status_code == 200
    lid1 = r1.json()["license_id"]
    lid2 = r2.json()["license_id"]
    lid3 = r3.json()["license_id"]
    assert lid1 == lid2 == lid3

    dup_txn = c.post(
        "/pmwa/store/admin/orders/fulfill",
        headers=headers,
        json={
            "order_id": "OTHER-ORDER",
            "paypal_txn_id": "E2E-TXN-DUP",
            "amount": 150.0,
            "currency": "EUR",
        },
    )
    assert dup_txn.status_code == 409


def test_fulfill_without_email_does_not_block_license(client, monkeypatch):
    """Email failure must not roll back fulfillment (SMTP optional)."""
    c = client
    headers = {"X-Admin-Key": ADMIN}
    oid = "E2E-NOMAIL"

    def boom(**kwargs):
        raise RuntimeError("SMTP down")

    monkeypatch.setattr("license_api.mailer.send_pmwa_order_confirmation", boom)

    c.post(
        "/pmwa/store/admin/orders/create",
        headers=headers,
        json={
            "order_id": oid,
            "plan": "1pc",
            "customer_email": "nomail@example.com",
            "customer_type": "individual",
            "amount": 70.0,
            "currency": "EUR",
        },
    )
    r = c.post(
        "/pmwa/store/admin/orders/fulfill",
        headers=headers,
        json={"order_id": oid, "paypal_txn_id": "E2E-NM", "amount": 70.0, "currency": "EUR"},
    )
    assert r.status_code == 200
    assert r.json()["payment_status"] == "paid"
    assert r.json().get("email_sent") is False
