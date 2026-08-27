# -*- coding: utf-8 -*-
"""Legacy NCC license table — preserved for older Palermo Business Agent tools."""

from __future__ import annotations

import os
import secrets
import sqlite3
import string
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field

router = APIRouter(prefix="/legacy/ncc", tags=["legacy-ncc"])

PLANS = {
    "1pc": {"max_machines": 1, "token_prefix": "NCC1"},
    "3pc": {"max_machines": 3, "token_prefix": "NCC3"},
}

DB_PATH = Path(os.environ.get("LICENSE_DB_PATH", str(Path(__file__).resolve().parent / "licenses.db")))


def migrate_legacy_ncc(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS licenses (
            token TEXT PRIMARY KEY,
            plan TEXT NOT NULL,
            days INTEGER NOT NULL,
            expires TEXT NOT NULL,
            note TEXT,
            customer_name TEXT,
            customer_email TEXT,
            payment_reference TEXT,
            max_machines INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS legacy_activations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT NOT NULL,
            machine_id TEXT NOT NULL,
            activated_at TEXT NOT NULL,
            UNIQUE(token, machine_id)
        );
        """
    )


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _require_admin(x_admin_key: str | None) -> None:
    expected = (os.environ.get("LICENSE_ADMIN_KEY") or "").strip()
    if not expected:
        raise HTTPException(status_code=500, detail="LICENSE_ADMIN_KEY not configured")
    if not secrets.compare_digest(x_admin_key or "", expected):
        raise HTTPException(status_code=401, detail="Invalid admin key")


def _generate_token(prefix: str) -> str:
    chars = string.ascii_uppercase + string.digits
    segments = ["".join(secrets.choice(chars) for _ in range(4)) for _ in range(4)]
    return f"{prefix}-{'-'.join(segments)}"


class LegacyIssueRequest(BaseModel):
    plan: str
    days: int = Field(365, ge=1, le=3650)
    note: str | None = None
    customer_name: str | None = None
    customer_email: EmailStr | None = None
    payment_reference: str | None = None


class LegacyActivateRequest(BaseModel):
    token: str
    machine_id: str = Field(..., min_length=1)


@router.post("/admin/issue")
def legacy_issue(body: LegacyIssueRequest, x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin(x_admin_key)
    plan_id = body.plan.strip().lower()
    if plan_id not in PLANS:
        raise HTTPException(status_code=400, detail=f"plan must be one of: {', '.join(PLANS)}")
    plan = PLANS[plan_id]
    token = _generate_token(plan["token_prefix"])
    expires = (date.today() + timedelta(days=body.days)).isoformat()
    created_at = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        migrate_legacy_ncc(conn)
        conn.execute(
            """
            INSERT INTO licenses (
                token, plan, days, expires, note,
                customer_name, customer_email, payment_reference,
                max_machines, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                token,
                plan_id,
                body.days,
                expires,
                body.note,
                body.customer_name,
                str(body.customer_email) if body.customer_email else None,
                body.payment_reference,
                plan["max_machines"],
                created_at,
            ),
        )
        conn.commit()
    return {"ok": True, "token": token, "plan": plan_id, "expires": expires}


@router.post("/activate")
def legacy_activate(body: LegacyActivateRequest) -> dict[str, Any]:
    token = body.token.strip()
    machine_id = body.machine_id.strip()
    with _connect() as conn:
        migrate_legacy_ncc(conn)
        lic = conn.execute("SELECT * FROM licenses WHERE token = ?", (token,)).fetchone()
        if lic is None:
            raise HTTPException(status_code=404, detail="License not found")
        expires = date.fromisoformat(lic["expires"])
        if expires < date.today():
            raise HTTPException(status_code=403, detail="License expired")
        existing = conn.execute(
            "SELECT * FROM legacy_activations WHERE token = ? AND machine_id = ?",
            (token, machine_id),
        ).fetchone()
        if existing:
            return {"ok": True, "already_activated": True, "token": token}
        count = conn.execute(
            "SELECT COUNT(*) AS n FROM legacy_activations WHERE token = ?", (token,)
        ).fetchone()["n"]
        if count >= lic["max_machines"]:
            raise HTTPException(status_code=403, detail="Max machines reached")
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "INSERT INTO legacy_activations (token, machine_id, activated_at) VALUES (?, ?, ?)",
            (token, machine_id, now),
        )
        conn.commit()
    return {"ok": True, "already_activated": False, "token": token}


@router.get("/admin/order/{token}")
def legacy_order(token: str, x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin(x_admin_key)
    with _connect() as conn:
        migrate_legacy_ncc(conn)
        lic = conn.execute("SELECT * FROM licenses WHERE token = ?", (token.strip(),)).fetchone()
        if lic is None:
            raise HTTPException(status_code=404, detail="Order not found")
        acts = conn.execute(
            "SELECT machine_id, activated_at FROM legacy_activations WHERE token = ?",
            (token.strip(),),
        ).fetchall()
    data = dict(lic)
    data["activations"] = [dict(a) for a in acts]
    return data
