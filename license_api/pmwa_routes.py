# -*- coding: utf-8 -*-
"""
PM Web Agent — authoritative license + DEMO quota API (FastAPI router).

Mount on the main license_api app. Private key: LICENSE_ED25519_PRIVATE_KEY_PATH
or LICENSE_ED25519_PRIVATE_KEY_HEX (never log secrets).
"""

from __future__ import annotations

import json
import logging
import os
import secrets
import sqlite3
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

try:
    from pmwa_crypto import build_lease_payload, sign_lease
except ImportError:  # package import
    from license_api.pmwa_crypto import build_lease_payload, sign_lease  # noqa: PLC0415

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pmwa", tags=["pmwa"])

DEMO_MAX_PER_CATEGORY = 20
OFFLINE_GRACE_DAYS = 7
DEFAULT_DAYS = int(os.environ.get("LICENSE_DAYS", "365"))

# Simple in-memory rate limit: fingerprint or IP → timestamps
_rate: dict[str, deque[float]] = defaultdict(deque)
_RATE_WINDOW = 60.0
_RATE_MAX = 40


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat()


def _fmt_z(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _rate_limit(key: str) -> None:
    now = time.time()
    q = _rate[key]
    while q and now - q[0] > _RATE_WINDOW:
        q.popleft()
    if len(q) >= _RATE_MAX:
        raise HTTPException(status_code=429, detail="Too many requests. Try again later.")
    q.append(now)


def _require_admin(x_admin_key: str | None) -> None:
    expected = (os.environ.get("LICENSE_ADMIN_KEY") or "").strip()
    if not expected or expected == "CAMBIA_QUESTA_CHIAVE_ADMIN":
        # Allow default only for local tests when explicitly set
        expected = os.environ.get("LICENSE_ADMIN_KEY", "CAMBIA_QUESTA_CHIAVE_ADMIN")
    provided = x_admin_key or ""
    if not secrets.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="admin key not valid")


def migrate_pmwa(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pmwa_licenses (
            license_id TEXT PRIMARY KEY,
            purchase_token TEXT UNIQUE NOT NULL,
            edition TEXT NOT NULL,
            max_devices INTEGER NOT NULL,
            activated_utc TEXT,
            expires_utc TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            note TEXT DEFAULT '',
            created_utc TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pmwa_devices (
            license_id TEXT NOT NULL,
            fingerprint_hex TEXT NOT NULL,
            activated_utc TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY (license_id, fingerprint_hex)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pmwa_demo_profiles (
            fingerprint_hex TEXT PRIMARY KEY,
            created_utc TEXT NOT NULL,
            upgraded INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pmwa_demo_quota (
            fingerprint_hex TEXT NOT NULL,
            category_key TEXT NOT NULL,
            label TEXT DEFAULT '',
            place_ids_json TEXT NOT NULL DEFAULT '[]',
            updated_utc TEXT NOT NULL,
            PRIMARY KEY (fingerprint_hex, category_key)
        )
        """
    )


def _make_license_id() -> str:
    raw = secrets.token_hex(6).upper()  # 12 hex
    return f"PMWA-LIC-{raw}"


def _make_purchase_token(edition: str) -> str:
    # Customer-facing activation code (same as license_id for simplicity & uniqueness)
    return _make_license_id()


def _normalize_edition(raw: str) -> tuple[str, int]:
    v = (raw or "").strip().lower()
    if v in ("1", "1pc", "pmwa_1pc", "one_pc"):
        return "1pc", 1
    if v in ("3", "3pc", "pmwa_3pc", "three_pc"):
        return "3pc", 3
    if v in ("demo", "pmwa_demo"):
        return "demo", 1
    raise HTTPException(status_code=400, detail="edition must be 1pc, 3pc, or demo")


def _valid_fp(fp: str) -> str:
    f = (fp or "").strip().lower()
    if len(f) != 64 or any(c not in "0123456789abcdef" for c in f):
        raise HTTPException(status_code=400, detail="fingerprint_hex invalid")
    return f


def _parse_exp(s: str) -> datetime:
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _sign_for_device(
    conn: sqlite3.Connection,
    lic: sqlite3.Row,
    fp: str,
) -> dict[str, Any]:
    payload = build_lease_payload(
        license_id=lic["license_id"],
        edition=lic["edition"],
        max_devices=int(lic["max_devices"]),
        device_fingerprint=fp,
        expires_at=_fmt_z(_parse_exp(str(lic["expires_utc"]))),
        status=str(lic["status"] or "active"),
        offline_grace_days=OFFLINE_GRACE_DAYS,
    )
    try:
        token = sign_lease(payload)
    except Exception:
        logger.exception("lease signing failed")
        raise HTTPException(status_code=500, detail="license signing unavailable") from None
    active = conn.execute(
        "SELECT COUNT(*) AS c FROM pmwa_devices WHERE license_id=? AND active=1",
        (lic["license_id"],),
    ).fetchone()["c"]
    return {
        "ok": True,
        "lease_token": token,
        "license_id": lic["license_id"],
        "edition": lic["edition"],
        "max_devices": int(lic["max_devices"]),
        "devices_used": int(active),
        "expires_at": payload["expires_at"],
        "status": lic["status"],
        "offline_grace_days": OFFLINE_GRACE_DAYS,
        "message": "License active.",
    }


# --- Bodies ---


class IssueBody(BaseModel):
    edition: str = Field(..., description="1pc or 3pc")
    days: int | None = None
    note: str = ""


class ActivateBody(BaseModel):
    purchase_token: str
    fingerprint_hex: str


class ValidateBody(BaseModel):
    license_id: str = ""
    purchase_token: str = ""
    fingerprint_hex: str


class RenewBody(BaseModel):
    license_id: str
    days: int = 365


class DemoRegisterBody(BaseModel):
    fingerprint_hex: str


class DemoClaimBody(BaseModel):
    fingerprint_hex: str
    category_key: str
    place_id: str = ""
    dedup_key: str = ""
    label: str = ""


class DemoStatusBody(BaseModel):
    fingerprint_hex: str
    category_key: str = ""


class DeviceDeactivateBody(BaseModel):
    license_id: str
    fingerprint_hex: str


def get_db_path():
    from pathlib import Path

    return Path(os.environ.get("LICENSE_DB_PATH", str(Path(__file__).resolve().parent / "licenses.db")))


def _conn() -> sqlite3.Connection:
    path = get_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(str(path))
    c.row_factory = sqlite3.Row
    return c


@router.get("/health")
def pmwa_health() -> dict[str, Any]:
    """Minimal public probe — no secrets."""
    return {"status": "ok", "service": "pmwa-license"}


@router.post("/admin/issue")
def admin_issue(body: IssueBody, x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin(x_admin_key)
    edition, max_d = _normalize_edition(body.edition)
    if edition == "demo":
        raise HTTPException(status_code=400, detail="use demo endpoints for DEMO")
    days = body.days if body.days and body.days > 0 else DEFAULT_DAYS
    now = _utcnow()
    lic_id = _make_purchase_token(edition)
    exp = now + timedelta(days=days)
    conn = _conn()
    try:
        migrate_pmwa(conn)
        conn.execute(
            """
            INSERT INTO pmwa_licenses(
                license_id, purchase_token, edition, max_devices,
                activated_utc, expires_utc, status, note, created_utc
            ) VALUES (?,?,?,?,NULL,?,?,?,?)
            """,
            (lic_id, lic_id, edition, max_d, _iso(exp), "active", body.note or "", _iso(now)),
        )
        conn.commit()
    finally:
        conn.close()
    return {
        "license_id": lic_id,
        "purchase_token": lic_id,
        "edition": edition,
        "max_devices": max_d,
        "expires_utc": _fmt_z(exp),
        "status": "active",
        "note": body.note or "",
    }


@router.post("/activate")
def activate(body: ActivateBody, request: Request) -> dict[str, Any]:
    client = (request.client.host if request.client else "unknown") or "unknown"
    _rate_limit(f"act:{client}")
    token = (body.purchase_token or "").strip().upper().replace(" ", "")
    fp = _valid_fp(body.fingerprint_hex)
    _rate_limit(f"actfp:{fp}")
    if not token.startswith("PMWA-LIC-"):
        raise HTTPException(status_code=400, detail="Invalid purchase token format")

    conn = _conn()
    try:
        migrate_pmwa(conn)
        lic = conn.execute(
            "SELECT * FROM pmwa_licenses WHERE purchase_token=? OR license_id=?",
            (token, token),
        ).fetchone()
        if lic is None:
            raise HTTPException(status_code=404, detail="Purchase token not found")
        if str(lic["status"] or "") != "active":
            raise HTTPException(status_code=403, detail="License is not active")
        if _utcnow() >= _parse_exp(str(lic["expires_utc"])):
            raise HTTPException(status_code=403, detail="License expired")

        row = conn.execute(
            "SELECT * FROM pmwa_devices WHERE license_id=? AND fingerprint_hex=?",
            (lic["license_id"], fp),
        ).fetchone()
        if row is not None:
            if int(row["active"] or 0) != 1:
                raise HTTPException(
                    status_code=403,
                    detail="This device was deactivated. Contact support to free a seat.",
                )
            if not lic["activated_utc"]:
                conn.execute(
                    "UPDATE pmwa_licenses SET activated_utc=? WHERE license_id=?",
                    (_iso(_utcnow()), lic["license_id"]),
                )
                conn.commit()
            return _sign_for_device(conn, lic, fp)

        active_count = conn.execute(
            "SELECT COUNT(*) AS c FROM pmwa_devices WHERE license_id=? AND active=1",
            (lic["license_id"],),
        ).fetchone()["c"]
        if int(active_count) >= int(lic["max_devices"]):
            raise HTTPException(
                status_code=403,
                detail="This license has reached its maximum number of activated devices.",
            )

        conn.execute(
            "INSERT INTO pmwa_devices(license_id, fingerprint_hex, activated_utc, active) VALUES (?,?,?,1)",
            (lic["license_id"], fp, _iso(_utcnow())),
        )
        if not lic["activated_utc"]:
            conn.execute(
                "UPDATE pmwa_licenses SET activated_utc=? WHERE license_id=?",
                (_iso(_utcnow()), lic["license_id"]),
            )
        conn.commit()
        lic = conn.execute(
            "SELECT * FROM pmwa_licenses WHERE license_id=?", (lic["license_id"],)
        ).fetchone()
        assert lic is not None
        return _sign_for_device(conn, lic, fp)
    finally:
        conn.close()


@router.post("/validate")
def validate(body: ValidateBody, request: Request) -> dict[str, Any]:
    client = (request.client.host if request.client else "unknown") or "unknown"
    _rate_limit(f"val:{client}")
    fp = _valid_fp(body.fingerprint_hex)
    key = (body.license_id or body.purchase_token or "").strip().upper().replace(" ", "")
    if not key:
        raise HTTPException(status_code=400, detail="license_id required")

    conn = _conn()
    try:
        migrate_pmwa(conn)
        lic = conn.execute(
            "SELECT * FROM pmwa_licenses WHERE license_id=? OR purchase_token=?",
            (key, key),
        ).fetchone()
        if lic is None:
            raise HTTPException(status_code=404, detail="License not found")
        if str(lic["status"] or "") != "active":
            raise HTTPException(status_code=403, detail="License is not active")
        if _utcnow() >= _parse_exp(str(lic["expires_utc"])):
            raise HTTPException(status_code=403, detail="License expired")

        row = conn.execute(
            "SELECT * FROM pmwa_devices WHERE license_id=? AND fingerprint_hex=? AND active=1",
            (lic["license_id"], fp),
        ).fetchone()
        if row is None:
            raise HTTPException(
                status_code=403,
                detail="This license has reached its maximum number of activated devices.",
            )
        return _sign_for_device(conn, lic, fp)
    finally:
        conn.close()


@router.post("/admin/renew")
def admin_renew(body: RenewBody, x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin(x_admin_key)
    lid = body.license_id.strip().upper()
    days = max(1, int(body.days or 365))
    conn = _conn()
    try:
        migrate_pmwa(conn)
        lic = conn.execute("SELECT * FROM pmwa_licenses WHERE license_id=?", (lid,)).fetchone()
        if lic is None:
            raise HTTPException(status_code=404, detail="License not found")
        base = max(_utcnow(), _parse_exp(str(lic["expires_utc"])))
        new_exp = base + timedelta(days=days)
        conn.execute(
            "UPDATE pmwa_licenses SET expires_utc=?, status='active' WHERE license_id=?",
            (_iso(new_exp), lid),
        )
        conn.commit()
        return {"ok": True, "license_id": lid, "expires_utc": _fmt_z(new_exp)}
    finally:
        conn.close()


@router.get("/admin/license/{license_id}")
def admin_license(license_id: str, x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin(x_admin_key)
    lid = license_id.strip().upper()
    conn = _conn()
    try:
        migrate_pmwa(conn)
        lic = conn.execute("SELECT * FROM pmwa_licenses WHERE license_id=?", (lid,)).fetchone()
        if lic is None:
            raise HTTPException(status_code=404, detail="not found")
        devices = conn.execute(
            "SELECT fingerprint_hex, activated_utc, active FROM pmwa_devices WHERE license_id=?",
            (lid,),
        ).fetchall()
        return {
            "license_id": lic["license_id"],
            "purchase_token": lic["purchase_token"],
            "edition": lic["edition"],
            "max_devices": int(lic["max_devices"]),
            "expires_utc": lic["expires_utc"],
            "status": lic["status"],
            "note": lic["note"],
            "devices": [dict(d) for d in devices],
        }
    finally:
        conn.close()


@router.post("/admin/device/deactivate")
def admin_deactivate(
    body: DeviceDeactivateBody, x_admin_key: str | None = Header(default=None)
) -> dict[str, Any]:
    _require_admin(x_admin_key)
    lid = body.license_id.strip().upper()
    fp = _valid_fp(body.fingerprint_hex)
    conn = _conn()
    try:
        migrate_pmwa(conn)
        cur = conn.execute(
            "UPDATE pmwa_devices SET active=0 WHERE license_id=? AND fingerprint_hex=?",
            (lid, fp),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="device not found")
        conn.commit()
        return {"ok": True, "license_id": lid, "fingerprint_hex": fp, "active": 0}
    finally:
        conn.close()


@router.post("/admin/device/reactivate")
def admin_reactivate(
    body: DeviceDeactivateBody, x_admin_key: str | None = Header(default=None)
) -> dict[str, Any]:
    """Re-enable a previously deactivated fingerprint without consuming an extra seat count logic beyond active flag."""
    _require_admin(x_admin_key)
    lid = body.license_id.strip().upper()
    fp = _valid_fp(body.fingerprint_hex)
    conn = _conn()
    try:
        migrate_pmwa(conn)
        lic = conn.execute("SELECT * FROM pmwa_licenses WHERE license_id=?", (lid,)).fetchone()
        if lic is None:
            raise HTTPException(status_code=404, detail="License not found")
        row = conn.execute(
            "SELECT * FROM pmwa_devices WHERE license_id=? AND fingerprint_hex=?",
            (lid, fp),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="device not found")
        if int(row["active"] or 0) == 1:
            return {"ok": True, "already_active": True}
        active_count = conn.execute(
            "SELECT COUNT(*) AS c FROM pmwa_devices WHERE license_id=? AND active=1",
            (lid,),
        ).fetchone()["c"]
        if int(active_count) >= int(lic["max_devices"]):
            raise HTTPException(
                status_code=403,
                detail="This license has reached its maximum number of activated devices.",
            )
        conn.execute(
            "UPDATE pmwa_devices SET active=1 WHERE license_id=? AND fingerprint_hex=?",
            (lid, fp),
        )
        conn.commit()
        return {"ok": True, "license_id": lid, "fingerprint_hex": fp, "active": 1}
    finally:
        conn.close()


@router.post("/demo/register")
def demo_register(body: DemoRegisterBody, request: Request) -> dict[str, Any]:
    client = (request.client.host if request.client else "unknown") or "unknown"
    _rate_limit(f"demo:{client}")
    fp = _valid_fp(body.fingerprint_hex)
    conn = _conn()
    try:
        migrate_pmwa(conn)
        row = conn.execute(
            "SELECT * FROM pmwa_demo_profiles WHERE fingerprint_hex=?", (fp,)
        ).fetchone()
        if row is None:
            conn.execute(
                "INSERT INTO pmwa_demo_profiles(fingerprint_hex, created_utc, upgraded) VALUES (?,?,0)",
                (fp, _iso(_utcnow())),
            )
            conn.commit()
            created = True
            upgraded = False
        else:
            created = False
            upgraded = bool(int(row["upgraded"] or 0))
        # Signed demo lease (edition=demo, long expiry for demo UX; quota is separate)
        far = _utcnow() + timedelta(days=3650)
        payload = build_lease_payload(
            license_id=f"DEMO-{fp[:12]}",
            edition="demo",
            max_devices=1,
            device_fingerprint=fp,
            expires_at=_fmt_z(far),
            status="demo_upgraded" if upgraded else "demo",
            offline_grace_days=OFFLINE_GRACE_DAYS,
        )
        token = sign_lease(payload)
        return {
            "ok": True,
            "created": created,
            "upgraded": upgraded,
            "lease_token": token,
            "offline_grace_days": OFFLINE_GRACE_DAYS,
        }
    finally:
        conn.close()


@router.post("/demo/quota/claim")
def demo_quota_claim(body: DemoClaimBody, request: Request) -> dict[str, Any]:
    client = (request.client.host if request.client else "unknown") or "unknown"
    _rate_limit(f"dq:{client}")
    fp = _valid_fp(body.fingerprint_hex)
    cat = (body.category_key or "").strip().casefold()
    if not cat or len(cat) > 200:
        raise HTTPException(status_code=400, detail="category_key invalid")
    dedup = (body.dedup_key or "").strip() or (body.place_id or "").strip()
    if not dedup:
        raise HTTPException(status_code=400, detail="place_id or dedup_key required")
    if body.place_id.strip():
        dedup = "pid:" + body.place_id.strip().casefold()
    elif not dedup.startswith("pid:") and not dedup.startswith("h:"):
        dedup = "h:" + dedup

    conn = _conn()
    try:
        migrate_pmwa(conn)
        prof = conn.execute(
            "SELECT * FROM pmwa_demo_profiles WHERE fingerprint_hex=?", (fp,)
        ).fetchone()
        if prof is None:
            conn.execute(
                "INSERT INTO pmwa_demo_profiles(fingerprint_hex, created_utc, upgraded) VALUES (?,?,0)",
                (fp, _iso(_utcnow())),
            )
        elif int(prof["upgraded"] or 0) == 1:
            return {
                "accepted": True,
                "reason": "upgraded",
                "used": 0,
                "max": DEMO_MAX_PER_CATEGORY,
                "limit_reached": False,
            }

        row = conn.execute(
            "SELECT * FROM pmwa_demo_quota WHERE fingerprint_hex=? AND category_key=?",
            (fp, cat),
        ).fetchone()
        ids: list[str] = []
        label = (body.label or cat).strip()
        if row:
            try:
                ids = list(json.loads(row["place_ids_json"] or "[]"))
            except json.JSONDecodeError:
                ids = []
            label = (row["label"] or label).strip()

        if dedup in ids:
            return {
                "accepted": True,
                "reason": "duplicate",
                "used": len(ids),
                "max": DEMO_MAX_PER_CATEGORY,
                "limit_reached": len(ids) >= DEMO_MAX_PER_CATEGORY,
                "label": label,
            }
        if len(ids) >= DEMO_MAX_PER_CATEGORY:
            return {
                "accepted": False,
                "reason": "limit_reached",
                "used": len(ids),
                "max": DEMO_MAX_PER_CATEGORY,
                "limit_reached": True,
                "label": label,
            }
        ids.append(dedup)
        blob = json.dumps(ids)
        conn.execute(
            """
            INSERT INTO pmwa_demo_quota(fingerprint_hex, category_key, label, place_ids_json, updated_utc)
            VALUES (?,?,?,?,?)
            ON CONFLICT(fingerprint_hex, category_key) DO UPDATE SET
              place_ids_json=excluded.place_ids_json,
              label=excluded.label,
              updated_utc=excluded.updated_utc
            """,
            (fp, cat, label, blob, _iso(_utcnow())),
        )
        conn.commit()
        return {
            "accepted": True,
            "reason": "counted",
            "used": len(ids),
            "max": DEMO_MAX_PER_CATEGORY,
            "limit_reached": len(ids) >= DEMO_MAX_PER_CATEGORY,
            "label": label,
        }
    finally:
        conn.close()


@router.post("/demo/quota/status")
def demo_quota_status(body: DemoStatusBody, request: Request) -> dict[str, Any]:
    client = (request.client.host if request.client else "unknown") or "unknown"
    _rate_limit(f"ds:{client}")
    fp = _valid_fp(body.fingerprint_hex)
    cat = (body.category_key or "").strip().casefold()
    conn = _conn()
    try:
        migrate_pmwa(conn)
        if cat:
            row = conn.execute(
                "SELECT * FROM pmwa_demo_quota WHERE fingerprint_hex=? AND category_key=?",
                (fp, cat),
            ).fetchone()
            ids = []
            label = cat
            if row:
                try:
                    ids = list(json.loads(row["place_ids_json"] or "[]"))
                except json.JSONDecodeError:
                    ids = []
                label = row["label"] or cat
            return {
                "label": label,
                "key": cat,
                "used": len(ids),
                "max": DEMO_MAX_PER_CATEGORY,
                "remaining": max(0, DEMO_MAX_PER_CATEGORY - len(ids)),
                "limit_reached": len(ids) >= DEMO_MAX_PER_CATEGORY,
            }
        rows = conn.execute(
            "SELECT * FROM pmwa_demo_quota WHERE fingerprint_hex=?", (fp,)
        ).fetchall()
        out = []
        for row in rows:
            try:
                ids = list(json.loads(row["place_ids_json"] or "[]"))
            except json.JSONDecodeError:
                ids = []
            out.append(
                {
                    "key": row["category_key"],
                    "label": row["label"] or row["category_key"],
                    "used": len(ids),
                    "max": DEMO_MAX_PER_CATEGORY,
                    "limit_reached": len(ids) >= DEMO_MAX_PER_CATEGORY,
                }
            )
        return {"categories": out}
    finally:
        conn.close()


@router.post("/admin/demo/mark-upgraded")
def admin_demo_upgraded(
    body: DemoRegisterBody, x_admin_key: str | None = Header(default=None)
) -> dict[str, Any]:
    _require_admin(x_admin_key)
    fp = _valid_fp(body.fingerprint_hex)
    conn = _conn()
    try:
        migrate_pmwa(conn)
        conn.execute(
            """
            INSERT INTO pmwa_demo_profiles(fingerprint_hex, created_utc, upgraded)
            VALUES (?,?,1)
            ON CONFLICT(fingerprint_hex) DO UPDATE SET upgraded=1
            """,
            (fp, _iso(_utcnow())),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()
