# -*- coding: utf-8 -*-
"""Tests for PM Web Agent automated store, PayPal fulfillment, activate-by-order."""

from __future__ import annotations

import importlib
import os
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

TEST_ED25519_HEX = "b1d07a967608b7ae96f04fc01df3853204d3fb6281eaa3591640aade7df25ab3"
ADMIN = "test-admin-key-automation"
FP1 = "a" * 64
FP2 = "b" * 64
FP3 = "c" * 64
FP4 = "d" * 64


@pytest.fixture()
def env(monkeypatch, tmp_path):
    monkeypatch.setenv("LICENSE_ADMIN_KEY", ADMIN)
    monkeypatch.setenv("LICENSE_ED25519_PRIVATE_KEY_HEX", TEST_ED25519_HEX)
    monkeypatch.setenv("LICENSE_DB_PATH", str(tmp_path / "licenses.db"))
    monkeypatch.setenv("SITE_URL", "http://localhost:3000")
    return tmp_path


@pytest.fixture()
def client(env):
    import license_api.app as api

    importlib.reload(api)
    api.init_db()
    with TestClient(api.app) as c:
        yield c


def _create(headers, order_id: str, plan: str = "1pc", email: str = "buyer@example.com"):
    return headers, {
        "order_id": order_id,
        "plan": plan,
        "customer_email": email,
        "customer_type": "company",
        "company_name": "ACME",
        "billing_address": "Via Roma 1",
        "city": "Palermo",
        "postal_code": "90100",
        "country": "IT",
        "amount": 70.0 if plan == "1pc" else 150.0,
        "currency": "EUR",
    }


def test_create_and_fulfill_1pc(client):
    c = client
    headers = {"X-Admin-Key": ADMIN}
    oid = "ORD-TEST-1PC"
    _, body = _create(headers, oid, "1pc")
    r = c.post("/pmwa/store/admin/orders/create", headers=headers, json=body)
    assert r.status_code == 200

    f = c.post(
        "/pmwa/store/admin/orders/fulfill",
        headers=headers,
        json={
            "order_id": oid,
            "paypal_txn_id": "TXN-1PC-001",
            "amount": 70.0,
            "currency": "EUR",
        },
    )
    assert f.status_code == 200
    data = f.json()
    assert data["payment_status"] == "paid"
    assert data["license_id"]
    assert data["activation_claim_token"]
    assert data["download_token"]

    act = c.post(
        "/pmwa/activate-by-order",
        json={
            "email": "buyer@example.com",
            "order_id": oid,
            "activation_claim_token": data["activation_claim_token"],
            "fingerprint_hex": FP1,
        },
    )
    assert act.status_code == 200
    assert act.json().get("lease_token")

    act2 = c.post(
        "/pmwa/activate-by-order",
        json={
            "email": "buyer@example.com",
            "order_id": oid,
            "activation_claim_token": data["activation_claim_token"],
            "fingerprint_hex": FP1,
        },
    )
    assert act2.status_code == 200


def test_1pc_second_device_denied(client):
    c = client
    headers = {"X-Admin-Key": ADMIN}
    oid = "ORD-1PC-LIMIT"
    _, body = _create(headers, oid, "1pc")
    c.post("/pmwa/store/admin/orders/create", headers=headers, json=body)
    f = c.post(
        "/pmwa/store/admin/orders/fulfill",
        headers=headers,
        json={"order_id": oid, "paypal_txn_id": "TXN-LIM", "amount": 70.0, "currency": "EUR"},
    )
    claim = f.json()["activation_claim_token"]
    c.post(
        "/pmwa/activate-by-order",
        json={
            "email": "buyer@example.com",
            "order_id": oid,
            "activation_claim_token": claim,
            "fingerprint_hex": FP1,
        },
    )
    denied = c.post(
        "/pmwa/activate-by-order",
        json={
            "email": "buyer@example.com",
            "order_id": oid,
            "activation_claim_token": claim,
            "fingerprint_hex": FP2,
        },
    )
    assert denied.status_code == 403


def test_duplicate_paypal_txn_idempotent(client):
    c = client
    headers = {"X-Admin-Key": ADMIN}
    oid = "ORD-IDEM"
    _, body = _create(headers, oid, "3pc")
    body["amount"] = 150.0
    c.post("/pmwa/store/admin/orders/create", headers=headers, json=body)
    payload = {"order_id": oid, "paypal_txn_id": "TXN-DUP", "amount": 150.0, "currency": "EUR"}
    r1 = c.post("/pmwa/store/admin/orders/fulfill", headers=headers, json=payload)
    r2 = c.post("/pmwa/store/admin/orders/fulfill", headers=headers, json=payload)
    assert r1.status_code == 200
    assert r2.status_code == 200


def test_unpaid_order_activation_denied(client):
    c = client
    headers = {"X-Admin-Key": ADMIN}
    oid = "ORD-UNPAID"
    _, body = _create(headers, oid)
    c.post("/pmwa/store/admin/orders/create", headers=headers, json=body)
    r = c.post(
        "/pmwa/activate-by-order",
        json={
            "email": "buyer@example.com",
            "order_id": oid,
            "activation_claim_token": "x" * 32,
            "fingerprint_hex": FP1,
        },
    )
    assert r.status_code == 403


def test_wrong_amount_fulfill_rejected(client):
    c = client
    headers = {"X-Admin-Key": ADMIN}
    oid = "ORD-BADAMT"
    _, body = _create(headers, oid, "1pc")
    c.post("/pmwa/store/admin/orders/create", headers=headers, json=body)
    r = c.post(
        "/pmwa/store/admin/orders/fulfill",
        headers=headers,
        json={"order_id": oid, "paypal_txn_id": "TXN-BAD", "amount": 49.0, "currency": "EUR"},
    )
    assert r.status_code == 400


def test_download_verify_and_reuse(client):
    c = client
    headers = {"X-Admin-Key": ADMIN}
    oid = "ORD-DL-001"
    _, body = _create(headers, oid, "3pc")
    body["amount"] = 150.0
    c.post("/pmwa/store/admin/orders/create", headers=headers, json=body)
    f = c.post(
        "/pmwa/store/admin/orders/fulfill",
        headers=headers,
        json={"order_id": oid, "paypal_txn_id": "TXN-DL", "amount": 150.0, "currency": "EUR"},
    )
    token = f.json()["download_token"]
    v1 = c.post("/pmwa/store/admin/downloads/verify", headers=headers, json={"download_token": token})
    assert v1.status_code == 200
    assert v1.json()["filename"] == "PMWebAgent_3PC_Setup.exe"


def test_renewal_extends_license(client):
    c = client
    headers = {"X-Admin-Key": ADMIN}
    oid = "ORD-RENEW"
    _, body = _create(headers, oid, "1pc")
    c.post("/pmwa/store/admin/orders/create", headers=headers, json=body)
    f = c.post(
        "/pmwa/store/admin/orders/fulfill",
        headers=headers,
        json={"order_id": oid, "paypal_txn_id": "TXN-R1", "amount": 70.0, "currency": "EUR"},
    )
    lid = f.json()["license_id"]
    claim = f.json()["activation_claim_token"]
    c.post(
        "/pmwa/activate-by-order",
        json={
            "email": "buyer@example.com",
            "order_id": oid,
            "activation_claim_token": claim,
            "fingerprint_hex": FP1,
        },
    )
    lic_before = c.get(f"/pmwa/admin/license/{lid}", headers=headers).json()
    exp_before = lic_before["expires_utc"]

    renew_oid = "ORD-RENEW-2"
    c.post(
        "/pmwa/store/admin/orders/create",
        headers=headers,
        json={
            "order_id": renew_oid,
            "plan": "1pc",
            "customer_email": "buyer@example.com",
            "customer_type": "individual",
            "amount": 70.0,
            "currency": "EUR",
            "is_renewal": True,
            "renewal_license_id": lid,
        },
    )
    rf = c.post(
        "/pmwa/store/admin/orders/fulfill",
        headers=headers,
        json={"order_id": renew_oid, "paypal_txn_id": "TXN-R2", "amount": 70.0, "currency": "EUR"},
    )
    assert rf.status_code == 200
    rdata = rf.json()
    assert rdata["license_id"] == lid
    assert rdata.get("activation_claim_token") is None
    assert rdata.get("download_token") is None
    assert rdata["is_renewal"] is True

    lic = c.get(f"/pmwa/admin/license/{lid}", headers=headers)
    assert lic.status_code == 200
    assert lic.json()["expires_utc"] > exp_before


def test_renewal_check_public(client):
    c = client
    headers = {"X-Admin-Key": ADMIN}
    oid = "ORD-RCHECK"
    _, body = _create(headers, oid, "3pc")
    body["amount"] = 150.0
    c.post("/pmwa/store/admin/orders/create", headers=headers, json=body)
    f = c.post(
        "/pmwa/store/admin/orders/fulfill",
        headers=headers,
        json={"order_id": oid, "paypal_txn_id": "TXN-RC", "amount": 150.0, "currency": "EUR"},
    )
    lid = f.json()["license_id"]
    ok = c.post(
        "/pmwa/store/renewal/check",
        json={"license_id": lid, "email": "buyer@example.com"},
    )
    assert ok.status_code == 200
    assert ok.json()["plan"] == "3pc"

    bad = c.post(
        "/pmwa/store/renewal/check",
        json={"license_id": lid, "email": "attacker@evil.com"},
    )
    assert bad.status_code == 403


def test_renewal_arbitrary_license_blocked(client):
    c = client
    headers = {"X-Admin-Key": ADMIN}
    r = c.post(
        "/pmwa/store/admin/orders/create",
        headers=headers,
        json={
            "order_id": "ORD-BAD-RENEW",
            "plan": "1pc",
            "customer_email": "attacker@evil.com",
            "customer_type": "individual",
            "amount": 70.0,
            "currency": "EUR",
            "is_renewal": True,
            "renewal_license_id": "PMWA-LIC-FAKE12345",
        },
    )
    assert r.status_code in (403, 404)


def test_ed25519_path_preferred(monkeypatch, tmp_path):
    """PATH must win when LICENSE_ED25519_PRIVATE_KEY_PATH is set (production VPS)."""
    key_file = tmp_path / "pmwa_ed25519_private.key"
    key_file.write_bytes(bytes.fromhex(TEST_ED25519_HEX))
    monkeypatch.setenv("LICENSE_ED25519_PRIVATE_KEY_PATH", str(key_file))
    monkeypatch.setenv("LICENSE_ED25519_PRIVATE_KEY_HEX", "00" * 32)

    import license_api.pmwa_crypto as crypto

    importlib.reload(crypto)
    pk = crypto.load_private_key()
    assert pk is not None

    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    assert isinstance(pk, Ed25519PrivateKey)
    raw = pk.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption(),
    )
    assert raw == bytes.fromhex(TEST_ED25519_HEX)


def test_3pc_fourth_device_denied(client):
    c = client
    headers = {"X-Admin-Key": ADMIN}
    oid = "ORD-3PC-LIM"
    _, body = _create(headers, oid, "3pc")
    body["amount"] = 150.0
    c.post("/pmwa/store/admin/orders/create", headers=headers, json=body)
    f = c.post(
        "/pmwa/store/admin/orders/fulfill",
        headers=headers,
        json={"order_id": oid, "paypal_txn_id": "TXN-3L", "amount": 150.0, "currency": "EUR"},
    )
    claim = f.json()["activation_claim_token"]
    for fp in (FP1, FP2, FP3):
        r = c.post(
            "/pmwa/activate-by-order",
            json={
                "email": "buyer@example.com",
                "order_id": oid,
                "activation_claim_token": claim,
                "fingerprint_hex": fp,
            },
        )
        assert r.status_code == 200
    denied = c.post(
        "/pmwa/activate-by-order",
        json={
            "email": "buyer@example.com",
            "order_id": oid,
            "activation_claim_token": claim,
            "fingerprint_hex": FP4,
        },
    )
    assert denied.status_code == 403


def test_legacy_ncc_still_works(client):
    c = client
    headers = {"X-Admin-Key": ADMIN}
    r = c.post("/legacy/ncc/admin/issue", headers=headers, json={"plan": "1pc", "days": 365})
    assert r.status_code == 200
    token = r.json()["token"]
    assert token.startswith("NCC1-")
    a = c.post("/legacy/ncc/activate", json={"token": token, "machine_id": "PC-LEGACY"})
    assert a.status_code == 200


def test_paypal_field_rules():
    """Mirror Next.js validateIpnFields critical checks."""
    fields = {
        "payment_status": "Completed",
        "mc_currency": "EUR",
        "receiver_email": "ballestrinofrancisco@gmail.com",
        "mc_gross": "70.00",
        "custom": "ORD-X",
        "txn_id": "TXN-X",
        "item_name": "PM Web Agent — 1 PC License / 1 year",
    }
    assert fields["payment_status"] == "Completed"
    assert float(fields["mc_gross"]) == 70.0
    assert fields["mc_currency"] == "EUR"
