# -*- coding: utf-8 -*-
"""PM Web Agent store orders, PayPal fulfillment, activate-by-order, protected downloads."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

try:
    from pmwa_crypto import build_lease_payload, sign_lease
    from pmwa_routes import (
        DEFAULT_DAYS,
        OFFLINE_GRACE_DAYS,
        _conn,
        _fmt_z,
        _iso,
        _make_license_id,
        _normalize_edition,
        _parse_exp,
        _require_admin,
        _sign_for_device,
        _utcnow,
        _valid_fp,
        migrate_pmwa,
    )
except ImportError:
    from license_api.pmwa_crypto import build_lease_payload, sign_lease  # noqa: PLC0415
    from license_api.pmwa_routes import (  # noqa: PLC0415
        DEFAULT_DAYS,
        OFFLINE_GRACE_DAYS,
        _conn,
        _fmt_z,
        _iso,
        _make_license_id,
        _normalize_edition,
        _parse_exp,
        _require_admin,
        _sign_for_device,
        _utcnow,
        _valid_fp,
        migrate_pmwa,
    )

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pmwa/store", tags=["pmwa-store"])

PLAN_AMOUNTS = {"1pc": 70.0, "3pc": 150.0}
DOWNLOAD_MAX_USES = int(os.environ.get("PMWA_DOWNLOAD_MAX_USES", "3"))
DOWNLOAD_TTL_HOURS = int(os.environ.get("PMWA_DOWNLOAD_TTL_HOURS", "72"))


def migrate_store(conn: sqlite3.Connection) -> None:
    migrate_pmwa(conn)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pmwa_store_orders (
            order_id TEXT PRIMARY KEY,
            plan TEXT NOT NULL,
            customer_email TEXT NOT NULL,
            customer_type TEXT NOT NULL DEFAULT 'company',
            company_name TEXT,
            billing_name TEXT,
            billing_address TEXT,
            city TEXT,
            region TEXT,
            postal_code TEXT,
            country TEXT,
            vat_tax_id TEXT,
            billing_json TEXT,
            amount REAL NOT NULL,
            currency TEXT NOT NULL DEFAULT 'EUR',
            payment_status TEXT NOT NULL DEFAULT 'pending',
            paypal_txn_id TEXT UNIQUE,
            license_id TEXT,
            activation_claim_token TEXT,
            download_token_hash TEXT,
            download_uses INTEGER NOT NULL DEFAULT 0,
            download_max INTEGER NOT NULL DEFAULT 3,
            download_expires_utc TEXT,
            is_renewal INTEGER NOT NULL DEFAULT 0,
            renewal_license_id TEXT,
            created_at TEXT NOT NULL,
            paid_at TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_pmwa_store_paypal_txn
        ON pmwa_store_orders(paypal_txn_id)
        WHERE paypal_txn_id IS NOT NULL AND paypal_txn_id <> ''
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_pmwa_store_download_hash
        ON pmwa_store_orders(download_token_hash)
        WHERE download_token_hash IS NOT NULL
        """
    )


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _issue_pmwa_license(
    conn: sqlite3.Connection,
    *,
    edition: str,
    max_d: int,
    days: int,
    note: str,
) -> str:
    now = _utcnow()
    lic_id = _make_license_id()
    exp = now + timedelta(days=days)
    conn.execute(
        """
        INSERT INTO pmwa_licenses(
            license_id, purchase_token, edition, max_devices,
            activated_utc, expires_utc, status, note, created_utc
        ) VALUES (?,?,?,?,NULL,?,?,?,?)
        """,
        (lic_id, lic_id, edition, max_d, _iso(exp), "active", note or "", _iso(now)),
    )
    return lic_id


def _renew_pmwa_license(conn: sqlite3.Connection, license_id: str, days: int) -> None:
    lic = conn.execute(
        "SELECT * FROM pmwa_licenses WHERE license_id=?", (license_id,)
    ).fetchone()
    if lic is None:
        raise HTTPException(status_code=404, detail="License not found for renewal")
    base = max(_utcnow(), _parse_exp(str(lic["expires_utc"])))
    new_exp = base + timedelta(days=days)
    conn.execute(
        "UPDATE pmwa_licenses SET expires_utc=?, status='active' WHERE license_id=?",
        (_iso(new_exp), license_id),
    )


def _activate_license_for_fingerprint(
    conn: sqlite3.Connection, license_id: str, fp: str
) -> dict[str, Any]:
    lic = conn.execute(
        "SELECT * FROM pmwa_licenses WHERE license_id=?", (license_id,)
    ).fetchone()
    if lic is None:
        raise HTTPException(status_code=404, detail="License not found")
    if str(lic["status"] or "") != "active":
        raise HTTPException(status_code=403, detail="License is not active")
    if _utcnow() >= _parse_exp(str(lic["expires_utc"])):
        raise HTTPException(status_code=403, detail="License expired")

    row = conn.execute(
        "SELECT * FROM pmwa_devices WHERE license_id=? AND fingerprint_hex=?",
        (license_id, fp),
    ).fetchone()
    if row is not None:
        if int(row["active"] or 0) != 1:
            raise HTTPException(status_code=403, detail="This device was deactivated.")
        if not lic["activated_utc"]:
            conn.execute(
                "UPDATE pmwa_licenses SET activated_utc=? WHERE license_id=?",
                (_iso(_utcnow()), license_id),
            )
        return _sign_for_device(conn, lic, fp)

    active_count = conn.execute(
        "SELECT COUNT(*) AS c FROM pmwa_devices WHERE license_id=? AND active=1",
        (license_id,),
    ).fetchone()["c"]
    if int(active_count) >= int(lic["max_devices"]):
        raise HTTPException(
            status_code=403,
            detail="This license has reached its maximum number of activated devices.",
        )
    conn.execute(
        "INSERT INTO pmwa_devices(license_id, fingerprint_hex, activated_utc, active) VALUES (?,?,?,1)",
        (license_id, fp, _iso(_utcnow())),
    )
    if not lic["activated_utc"]:
        conn.execute(
            "UPDATE pmwa_licenses SET activated_utc=? WHERE license_id=?",
            (_iso(_utcnow()), license_id),
        )
    lic = conn.execute(
        "SELECT * FROM pmwa_licenses WHERE license_id=?", (license_id,)
    ).fetchone()
    assert lic is not None
    return _sign_for_device(conn, lic, fp)


class CreateOrderBody(BaseModel):
    order_id: str = Field(..., min_length=8, max_length=64)
    plan: str
    customer_email: EmailStr
    customer_type: str = "company"
    company_name: str | None = None
    billing_name: str | None = None
    billing_address: str | None = None
    city: str | None = None
    region: str | None = None
    postal_code: str | None = None
    country: str = "IT"
    vat_tax_id: str | None = None
    billing_json: dict[str, Any] | None = None
    amount: float
    currency: str = "EUR"
    is_renewal: bool = False
    renewal_license_id: str | None = None


class FulfillOrderBody(BaseModel):
    order_id: str
    paypal_txn_id: str
    amount: float
    currency: str = "EUR"
    receiver_email: str | None = None


class ActivateByOrderBody(BaseModel):
    email: EmailStr
    order_id: str
    activation_claim_token: str = Field(..., min_length=16)
    fingerprint_hex: str


class DownloadVerifyBody(BaseModel):
    download_token: str


class RenewalCheckBody(BaseModel):
    license_id: str = Field(..., min_length=12)
    email: EmailStr


def _verify_renewal_eligibility(conn: sqlite3.Connection, license_id: str, email: str) -> dict[str, Any]:
    """Ensure license_id + email match a prior paid purchase — blocks arbitrary renewals."""
    lid = license_id.strip().upper()
    em = email.strip().lower()
    if not lid.startswith("PMWA-LIC-"):
        raise HTTPException(status_code=400, detail="Invalid license ID format")

    lic = conn.execute("SELECT * FROM pmwa_licenses WHERE license_id=?", (lid,)).fetchone()
    if lic is None:
        raise HTTPException(status_code=404, detail="License not found")

    orig = conn.execute(
        """
        SELECT * FROM pmwa_store_orders
        WHERE license_id=? AND customer_email=? AND payment_status='paid'
        ORDER BY paid_at ASC LIMIT 1
        """,
        (lid, em),
    ).fetchone()
    if orig is None:
        raise HTTPException(status_code=403, detail="Email does not match license purchase records")

    edition = str(lic["edition"] or orig["plan"])
    if edition not in PLAN_AMOUNTS:
        raise HTTPException(status_code=400, detail="Unsupported license edition")

    return {
        "eligible": True,
        "license_id": lid,
        "plan": edition,
        "amount": PLAN_AMOUNTS[edition],
        "expires_utc": lic["expires_utc"],
        "max_devices": int(lic["max_devices"]),
    }


@router.post("/renewal/check")
def renewal_check(body: RenewalCheckBody) -> dict[str, Any]:
    """Public pre-check before creating a renewal PayPal order."""
    conn = _conn()
    try:
        migrate_store(conn)
        return _verify_renewal_eligibility(conn, body.license_id, str(body.email))
    finally:
        conn.close()


@router.post("/admin/orders/create")
def create_order(body: CreateOrderBody, x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin(x_admin_key)
    if body.currency.upper() != "EUR":
        raise HTTPException(status_code=400, detail="currency must be EUR")
    if body.is_renewal and not body.renewal_license_id:
        raise HTTPException(status_code=400, detail="renewal_license_id required")

    conn = _conn()
    try:
        migrate_store(conn)
        if body.is_renewal:
            rid = (body.renewal_license_id or "").strip().upper()
            info = _verify_renewal_eligibility(conn, rid, str(body.customer_email))
            edition = info["plan"]
            if edition != _normalize_edition(body.plan)[0]:
                raise HTTPException(status_code=400, detail="plan does not match license edition")
        else:
            edition, _ = _normalize_edition(body.plan)
    finally:
        conn.close()

    expected = PLAN_AMOUNTS.get(edition)
    if expected is None or abs(float(body.amount) - expected) > 0.01:
        raise HTTPException(status_code=400, detail="amount does not match plan")

    now = _iso(_utcnow())
    conn = _conn()
    try:
        migrate_store(conn)
        existing = conn.execute(
            "SELECT * FROM pmwa_store_orders WHERE order_id=?", (body.order_id,)
        ).fetchone()
        if existing is not None:
            if existing["payment_status"] == "paid":
                raise HTTPException(status_code=409, detail="order already paid")
            conn.execute(
                """
                UPDATE pmwa_store_orders SET
                    plan=?, customer_email=?, customer_type=?, company_name=?, billing_name=?,
                    billing_address=?, city=?, region=?, postal_code=?, country=?, vat_tax_id=?,
                    billing_json=?, amount=?, currency=?, is_renewal=?, renewal_license_id=?
                WHERE order_id=?
                """,
                (
                    edition,
                    str(body.customer_email).strip().lower(),
                    body.customer_type,
                    body.company_name,
                    body.billing_name,
                    body.billing_address,
                    body.city,
                    body.region,
                    body.postal_code,
                    body.country,
                    body.vat_tax_id,
                    json.dumps(body.billing_json or {}),
                    float(body.amount),
                    body.currency.upper(),
                    1 if body.is_renewal else 0,
                    (body.renewal_license_id or "").strip().upper() or None,
                    body.order_id,
                ),
            )
            conn.commit()
            return {"ok": True, "order_id": body.order_id, "plan": edition, "status": "pending", "updated": True}
        conn.execute(
            """
            INSERT INTO pmwa_store_orders(
                order_id, plan, customer_email, customer_type, company_name, billing_name,
                billing_address, city, region, postal_code, country, vat_tax_id, billing_json,
                amount, currency, payment_status, created_at, is_renewal, renewal_license_id
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?)
            """,
            (
                body.order_id,
                edition,
                str(body.customer_email).strip().lower(),
                body.customer_type,
                body.company_name,
                body.billing_name,
                body.billing_address,
                body.city,
                body.region,
                body.postal_code,
                body.country,
                body.vat_tax_id,
                json.dumps(body.billing_json or {}),
                float(body.amount),
                body.currency.upper(),
                now,
                1 if body.is_renewal else 0,
                (body.renewal_license_id or "").strip().upper() or None,
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return {"ok": True, "order_id": body.order_id, "plan": edition, "status": "pending"}


@router.post("/admin/orders/fulfill")
def fulfill_order(body: FulfillOrderBody, x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin(x_admin_key)
    txn = body.paypal_txn_id.strip()
    if not txn:
        raise HTTPException(status_code=400, detail="paypal_txn_id required")

    conn = _conn()
    try:
        migrate_store(conn)
        dup = conn.execute(
            "SELECT order_id FROM pmwa_store_orders WHERE paypal_txn_id=? AND order_id<>?",
            (txn, body.order_id),
        ).fetchone()
        if dup is not None:
            raise HTTPException(status_code=409, detail="paypal_txn_id already used")

        row = conn.execute(
            "SELECT * FROM pmwa_store_orders WHERE order_id=?", (body.order_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="order not found")

        if row["payment_status"] == "paid" and row["license_id"]:
            if row["paypal_txn_id"] == txn:
                return _order_public_fields(row, include_secrets=False)
            raise HTTPException(status_code=409, detail="order already paid with different txn")

        edition = row["plan"]
        expected = PLAN_AMOUNTS.get(edition)
        if expected is None or abs(float(body.amount) - expected) > 0.01:
            raise HTTPException(status_code=400, detail="amount mismatch")
        if body.currency.upper() != "EUR":
            raise HTTPException(status_code=400, detail="currency mismatch")

        is_renewal = int(row["is_renewal"] or 0) == 1
        if is_renewal:
            lid = (row["renewal_license_id"] or "").strip().upper()
            if not lid:
                raise HTTPException(status_code=400, detail="renewal_license_id missing")
            _verify_renewal_eligibility(conn, lid, str(row["customer_email"]))
            _renew_pmwa_license(conn, lid, DEFAULT_DAYS)
            license_id = lid
            conn.execute(
                """
                UPDATE pmwa_store_orders SET
                    payment_status='paid',
                    paypal_txn_id=?,
                    paid_at=?,
                    license_id=?
                WHERE order_id=?
                """,
                (txn, _iso(_utcnow()), license_id, body.order_id),
            )
            conn.commit()
            refreshed = conn.execute(
                "SELECT * FROM pmwa_store_orders WHERE order_id=?", (body.order_id,)
            ).fetchone()
            assert refreshed is not None
            out = _order_public_fields(refreshed, include_secrets=False)
            site = (os.environ.get("SITE_URL") or "https://distemanagementsoftware.it").rstrip("/")
            success_url = f"{site}/purchase/success?order={body.order_id}"
            try:
                try:
                    from mailer import send_pmwa_renewal_confirmation
                except ImportError:
                    from license_api.mailer import send_pmwa_renewal_confirmation  # noqa: PLC0415
                send_pmwa_renewal_confirmation(
                    to_address=str(refreshed["customer_email"]),
                    order_id=body.order_id,
                    license_id=license_id,
                    plan_id=str(refreshed["plan"]),
                    success_url=success_url,
                )
                out["email_sent"] = True
            except Exception:
                logger.exception("renewal confirmation email failed order=%s", body.order_id)
                out["email_sent"] = False
            return out

        max_d = 1 if edition == "1pc" else 3
        license_id = _issue_pmwa_license(
            conn,
            edition=edition,
            max_d=max_d,
            days=DEFAULT_DAYS,
            note=f"store order {body.order_id}",
        )

        claim = secrets.token_urlsafe(32)
        download_raw = secrets.token_urlsafe(32)
        download_hash = _hash_token(download_raw)
        dl_exp = _iso(_utcnow() + timedelta(hours=DOWNLOAD_TTL_HOURS))

        conn.execute(
            """
            UPDATE pmwa_store_orders SET
                payment_status='paid',
                paypal_txn_id=?,
                paid_at=?,
                license_id=?,
                activation_claim_token=?,
                download_token_hash=?,
                download_uses=0,
                download_max=?,
                download_expires_utc=?
            WHERE order_id=?
            """,
            (
                txn,
                _iso(_utcnow()),
                license_id,
                claim,
                download_hash,
                DOWNLOAD_MAX_USES,
                dl_exp,
                body.order_id,
            ),
        )
        conn.commit()
        refreshed = conn.execute(
            "SELECT * FROM pmwa_store_orders WHERE order_id=?", (body.order_id,)
        ).fetchone()
        assert refreshed is not None
        out = _order_public_fields(refreshed, include_secrets=True)
        out["download_token"] = download_raw

        site = (os.environ.get("SITE_URL") or "https://distemanagementsoftware.it").rstrip("/")
        download_url = f"{site}/api/download/{download_raw}"
        success_url = f"{site}/purchase/success?order={body.order_id}"
        try:
            try:
                from mailer import send_pmwa_order_confirmation
            except ImportError:
                from license_api.mailer import send_pmwa_order_confirmation  # noqa: PLC0415
            send_pmwa_order_confirmation(
                to_address=str(refreshed["customer_email"]),
                order_id=body.order_id,
                plan_id=str(refreshed["plan"]),
                download_url=download_url,
                success_url=success_url,
            )
            out["email_sent"] = True
        except Exception:
            logger.exception("order confirmation email failed order=%s", body.order_id)
            out["email_sent"] = False

        return out
    finally:
        conn.close()


def _order_public_fields(row: sqlite3.Row, *, include_secrets: bool = False) -> dict[str, Any]:
    out: dict[str, Any] = {
        "order_id": row["order_id"],
        "plan": row["plan"],
        "customer_email": row["customer_email"],
        "amount": float(row["amount"]),
        "currency": row["currency"],
        "payment_status": row["payment_status"],
        "license_id": row["license_id"],
        "created_at": row["created_at"],
        "paid_at": row["paid_at"],
        "is_renewal": bool(int(row["is_renewal"] or 0)),
        "renewal_license_id": row["renewal_license_id"],
        "download_expires_utc": row["download_expires_utc"],
        "download_uses": int(row["download_uses"] or 0),
        "download_max": int(row["download_max"] or DOWNLOAD_MAX_USES),
    }
    if include_secrets:
        out["activation_claim_token"] = row["activation_claim_token"]
    return out


@router.get("/admin/orders/{order_id}")
def get_order_admin(order_id: str, x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin(x_admin_key)
    conn = _conn()
    try:
        migrate_store(conn)
        row = conn.execute(
            "SELECT * FROM pmwa_store_orders WHERE order_id=?", (order_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="order not found")
        return _order_public_fields(row, include_secrets=True)
    finally:
        conn.close()


@router.get("/orders/{order_id}/status")
def get_order_status(order_id: str) -> dict[str, Any]:
    """Public status for success page — no secrets."""
    conn = _conn()
    try:
        migrate_store(conn)
        row = conn.execute(
            "SELECT * FROM pmwa_store_orders WHERE order_id=?", (order_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="order not found")
        return _order_public_fields(row, include_secrets=False)
    finally:
        conn.close()


def _do_activate_by_order(body: ActivateByOrderBody) -> dict[str, Any]:
    email = str(body.email).strip().lower()
    order_id = body.order_id.strip()
    claim = body.activation_claim_token.strip()
    fp = _valid_fp(body.fingerprint_hex)

    conn = _conn()
    try:
        migrate_store(conn)
        row = conn.execute(
            "SELECT * FROM pmwa_store_orders WHERE order_id=?", (order_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Order not found")
        if row["customer_email"].lower() != email:
            raise HTTPException(status_code=403, detail="Email does not match order")
        if row["payment_status"] != "paid":
            raise HTTPException(status_code=403, detail="Order is not paid")
        if not secrets.compare_digest(str(row["activation_claim_token"] or ""), claim):
            raise HTTPException(status_code=403, detail="Invalid activation claim")
        license_id = row["license_id"]
        if not license_id:
            raise HTTPException(status_code=500, detail="License not provisioned")

        result = _activate_license_for_fingerprint(conn, str(license_id), fp)
        conn.commit()
        result["order_id"] = order_id
        return result
    finally:
        conn.close()


@router.post("/activate-by-order")
def activate_by_order_store(body: ActivateByOrderBody, request: Request) -> dict[str, Any]:
    return _do_activate_by_order(body)


public_router = APIRouter(prefix="/pmwa", tags=["pmwa-activation"])


@public_router.post("/activate-by-order")
def activate_by_order_public(body: ActivateByOrderBody, request: Request) -> dict[str, Any]:
    return _do_activate_by_order(body)


@router.post("/admin/downloads/verify")
def verify_download(body: DownloadVerifyBody, x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin(x_admin_key)
    token_hash = _hash_token(body.download_token.strip())
    conn = _conn()
    try:
        migrate_store(conn)
        row = conn.execute(
            "SELECT * FROM pmwa_store_orders WHERE download_token_hash=?", (token_hash,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="invalid download token")
        if row["payment_status"] != "paid":
            raise HTTPException(status_code=403, detail="order not paid")
        if row["download_expires_utc"]:
            if _utcnow() >= _parse_exp(str(row["download_expires_utc"])):
                raise HTTPException(status_code=403, detail="download token expired")
        uses = int(row["download_uses"] or 0)
        max_uses = int(row["download_max"] or DOWNLOAD_MAX_USES)
        if uses >= max_uses:
            raise HTTPException(status_code=403, detail="download limit reached")
        filename = "PMWebAgent_1PC_Setup.exe" if row["plan"] == "1pc" else "PMWebAgent_3PC_Setup.exe"
        conn.execute(
            "UPDATE pmwa_store_orders SET download_uses = download_uses + 1 WHERE order_id=?",
            (row["order_id"],),
        )
        conn.commit()
        return {
            "ok": True,
            "order_id": row["order_id"],
            "plan": row["plan"],
            "filename": filename,
            "uses": uses + 1,
            "max": max_uses,
        }
    finally:
        conn.close()
