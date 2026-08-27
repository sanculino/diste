# -*- coding: utf-8 -*-
"""
API licenze Palermo Business Agent (FastAPI).

Contratto compatibile con l'app desktop già compilata:
  GET  /health
  POST /activate          body: token, fingerprint_hex, product
  POST /admin/issue
  GET  /admin/order/{token}
  POST /admin/test-email

Tabelle: orders + activations (schema compatibile con produzione; nessuna tabella licenses).

Avvio:
  uvicorn app:app --host 127.0.0.1 --port 8090
"""

from __future__ import annotations

import logging
import os
import secrets
import sqlite3
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

try:
    from mailer import (  # type: ignore  # noqa: PLC0415
        plan_max_pc,
        plan_title,
        send_license_email,
        send_test_email,
    )
except ImportError:
    from license_api.mailer import (  # noqa: PLC0415
        plan_max_pc,
        plan_title,
        send_license_email,
        send_test_email,
    )

ADMIN_KEY = os.environ.get("LICENSE_ADMIN_KEY", "CAMBIA_QUESTA_CHIAVE_ADMIN")
DB_PATH = Path(os.environ.get("LICENSE_DB_PATH", str(Path(__file__).resolve().parent / "licenses.db")))
DEFAULT_DAYS = int(os.environ.get("LICENSE_DAYS", "365"))

_EXTRA_ORDER_COLUMNS: tuple[tuple[str, str], ...] = (
    ("customer_name", "TEXT"),
    ("customer_email", "TEXT"),
    ("payment_reference", "TEXT"),
    ("email_sent", "INTEGER NOT NULL DEFAULT 0"),
    ("email_sent_utc", "TEXT"),
    ("email_error", "TEXT"),
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat()


def _safe_error_name(exc: BaseException) -> str:
    return type(exc).__name__


@contextmanager
def _db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    rows = conn.execute(f'PRAGMA table_info("{table}")').fetchall()
    return {str(r["name"]) for r in rows}


def migrate_db(conn: sqlite3.Connection | None = None) -> None:
    """Crea schema base e aggiunge colonne email senza distruggere dati."""

    def _run(c: sqlite3.Connection) -> None:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
                token TEXT PRIMARY KEY,
                plan TEXT NOT NULL,
                max_machines INTEGER NOT NULL,
                expires_utc TEXT NOT NULL,
                created_utc TEXT NOT NULL,
                note TEXT DEFAULT ''
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS activations (
                token TEXT NOT NULL,
                fingerprint_hex TEXT NOT NULL,
                activated_utc TEXT NOT NULL,
                PRIMARY KEY (token, fingerprint_hex)
            )
            """
        )
        cols = _table_columns(c, "orders")
        for name, decl in _EXTRA_ORDER_COLUMNS:
            if name not in cols:
                c.execute(f'ALTER TABLE orders ADD COLUMN {name} {decl}')
        c.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_reference_unique
            ON orders(payment_reference)
            WHERE payment_reference IS NOT NULL
              AND payment_reference <> ''
            """
        )

    if conn is not None:
        _run(conn)
        return
    with _db() as c:
        _run(c)


def init_db() -> None:
    migrate_db()
    try:
        try:
            from pmwa_routes import migrate_pmwa
            from pmwa_store_routes import migrate_store
        except ImportError:
            from license_api.pmwa_routes import migrate_pmwa  # noqa: PLC0415
            from license_api.pmwa_store_routes import migrate_store  # noqa: PLC0415
        with _db() as c:
            migrate_pmwa(c)
            migrate_store(c)
        try:
            from legacy_ncc import migrate_legacy_ncc
        except ImportError:
            from license_api.legacy_ncc import migrate_legacy_ncc  # noqa: PLC0415
        with _db() as c:
            migrate_legacy_ncc(c)
    except Exception:
        logger.exception("pmwa migrate skipped")


def _make_token(plan: str) -> str:
    prefix = "NCC1" if plan == "1pc" else "NCC3"
    raw = secrets.token_hex(10).upper()
    parts = [raw[i : i + 4] for i in range(0, 20, 4)]
    return prefix + "-" + "-".join(parts)


def _normalize_plan(raw: str) -> tuple[str, int]:
    v = (raw or "").strip().lower()
    if v in ("1", "1pc", "one_pc", "one_pc_1y", "one_pc_1y_paypal", "standard"):
        return "1pc", 1
    if v in ("3", "3pc", "three_pc", "three_pc_1y", "three_pc_1y_paypal", "pro"):
        return "3pc", 3
    raise HTTPException(status_code=400, detail="plan deve essere 1pc o 3pc")


def _normalize_product(raw: str) -> str:
    v = (raw or "").strip().lower()
    if v in ("one_pc_1y_paypal", "one_pc_1y", "1pc"):
        return "1pc"
    if v in ("three_pc_1y_paypal", "three_pc_1y", "3pc"):
        return "3pc"
    raise HTTPException(status_code=400, detail="product non valido")


def _require_admin(x_admin_key: str | None) -> None:
    expected = (os.environ.get("LICENSE_ADMIN_KEY") or ADMIN_KEY or "").strip()
    if not expected or expected == "CAMBIA_QUESTA_CHIAVE_ADMIN":
        # Still allow tests that set LICENSE_ADMIN_KEY; reject empty
        if not expected:
            raise HTTPException(status_code=500, detail="LICENSE_ADMIN_KEY non configurata")
    provided = x_admin_key or ""
    if not secrets.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="admin key non valida")


def _order_response_fields(row: sqlite3.Row, *, already_issued: bool | None = None) -> dict[str, Any]:
    email_sent_raw = row["email_sent"] if "email_sent" in row.keys() else 0
    try:
        email_sent_flag = int(email_sent_raw or 0) == 1
    except (TypeError, ValueError):
        email_sent_flag = bool(email_sent_raw)
    out: dict[str, Any] = {
        "token": row["token"],
        "plan": row["plan"],
        "max_machines": int(row["max_machines"]),
        "expires_utc": row["expires_utc"],
        "note": row["note"] or "",
        "customer_name": row["customer_name"] if "customer_name" in row.keys() else None,
        "customer_email": row["customer_email"] if "customer_email" in row.keys() else None,
        "payment_reference": row["payment_reference"] if "payment_reference" in row.keys() else None,
        "email_sent": email_sent_flag,
        "email_sent_utc": row["email_sent_utc"] if "email_sent_utc" in row.keys() else None,
        "email_error": row["email_error"] if "email_error" in row.keys() else None,
    }
    if already_issued is not None:
        out["already_issued"] = already_issued
    return out


def _mark_email_ok(conn: sqlite3.Connection, token: str) -> None:
    conn.execute(
        """
        UPDATE orders
           SET email_sent = 1,
               email_sent_utc = ?,
               email_error = NULL
         WHERE token = ?
        """,
        (_iso(_utcnow()), token),
    )


def _mark_email_err(conn: sqlite3.Connection, token: str, err_name: str) -> None:
    conn.execute(
        """
        UPDATE orders
           SET email_sent = 0,
               email_sent_utc = NULL,
               email_error = ?
         WHERE token = ?
        """,
        (err_name, token),
    )


def _maybe_send_license_email(
    conn: sqlite3.Connection,
    row: sqlite3.Row,
    *,
    force_retry: bool,
) -> tuple[bool, str | None, str | None]:
    """
    Ritorna (email_sent, email_sent_utc, email_error).
    Non reinvia se email_sent già 1 (salvo che non sia force_retry e già inviata).
    """
    token = row["token"]
    customer_email = (row["customer_email"] or "").strip() if "customer_email" in row.keys() else ""
    already = 0
    if "email_sent" in row.keys():
        try:
            already = int(row["email_sent"] or 0)
        except (TypeError, ValueError):
            already = 1 if row["email_sent"] else 0

    if not customer_email:
        return False, None, None

    if already == 1 and not force_retry:
        utc = row["email_sent_utc"] if "email_sent_utc" in row.keys() else None
        return True, utc, None

    if already == 1:
        utc = row["email_sent_utc"] if "email_sent_utc" in row.keys() else None
        return True, utc, None

    try:
        send_license_email(
            to_address=customer_email,
            client_name=(row["customer_name"] or "Cliente") if "customer_name" in row.keys() else "Cliente",
            plan_id=row["plan"],
            plan_title_str=plan_title(row["plan"]),
            token=token,
            expires=row["expires_utc"],
            max_pc=plan_max_pc(row["plan"]),
        )
        _mark_email_ok(conn, token)
        return True, _iso(_utcnow()), None
    except Exception as exc:  # noqa: BLE001
        err = _safe_error_name(exc)
        _mark_email_err(conn, token, err)
        logger.exception("SMTP error while sending license email plan=%s", row["plan"])
        return False, None, err


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="DI.S.TE License API",
    version="1.2.0",
    lifespan=lifespan,
)

# PM Web Agent authoritative licensing + DEMO quota
try:
    from pmwa_routes import router as pmwa_router
except ImportError:
    from license_api.pmwa_routes import router as pmwa_router  # noqa: PLC0415

try:
    from pmwa_store_routes import router as pmwa_store_router
except ImportError:
    from license_api.pmwa_store_routes import router as pmwa_store_router  # noqa: PLC0415

try:
    from legacy_ncc import router as legacy_ncc_router
except ImportError:
    from license_api.legacy_ncc import router as legacy_ncc_router  # noqa: PLC0415

app.include_router(pmwa_router)
app.include_router(pmwa_store_router)

try:
    from pmwa_store_routes import public_router as pmwa_activate_public_router
except ImportError:
    from license_api.pmwa_store_routes import public_router as pmwa_activate_public_router  # noqa: PLC0415

app.include_router(pmwa_activate_public_router)
app.include_router(legacy_ncc_router)


class IssueBody(BaseModel):
    plan: str = Field(..., description="1pc oppure 3pc (alias accettati)")
    days: int | None = None
    note: str = ""
    customer_name: str | None = None
    customer_email: str | None = None
    payment_reference: str | None = None


class ActivateBody(BaseModel):
    token: str
    fingerprint_hex: str
    product: str = Field(..., description="one_pc_1y_paypal | three_pc_1y_paypal | …")


class TestEmailBody(BaseModel):
    email: str
    plan: str = "1pc"


@app.get("/health")
def health() -> dict[str, str]:
    """Minimal public probe — no secrets, no config dump."""
    return {"status": "ok", "service": "pmwa-license"}


@app.post("/admin/issue")
def admin_issue(
    body: IssueBody,
    x_admin_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_admin(x_admin_key)
    plan, max_machines = _normalize_plan(body.plan)
    days = body.days if body.days and body.days > 0 else DEFAULT_DAYS
    note = body.note or ""
    customer_name = (body.customer_name or "").strip() or None
    customer_email = (body.customer_email or "").strip() or None
    payment_reference = (body.payment_reference or "").strip() or None

    with _db() as conn:
        migrate_db(conn)

        if payment_reference:
            existing = conn.execute(
                "SELECT * FROM orders WHERE payment_reference = ?",
                (payment_reference,),
            ).fetchone()
            if existing is not None:
                # Ritenta email solo se non ancora inviata
                sent, sent_utc, err = _maybe_send_license_email(
                    conn, existing, force_retry=False
                )
                refreshed = conn.execute(
                    "SELECT * FROM orders WHERE token = ?",
                    (existing["token"],),
                ).fetchone()
                assert refreshed is not None
                out = _order_response_fields(refreshed, already_issued=True)
                out["email_sent"] = sent
                out["email_sent_utc"] = sent_utc if sent else refreshed["email_sent_utc"]
                out["email_error"] = err
                return out

        now = _utcnow()
        exp = now + timedelta(days=days)
        token = _make_token(plan)
        conn.execute(
            """
            INSERT INTO orders(
                token, plan, max_machines, expires_utc, created_utc, note,
                customer_name, customer_email, payment_reference,
                email_sent, email_sent_utc, email_error
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                token,
                plan,
                max_machines,
                _iso(exp),
                _iso(now),
                note,
                customer_name,
                customer_email,
                payment_reference,
                0,
                None,
                None,
            ),
        )
        row = conn.execute("SELECT * FROM orders WHERE token = ?", (token,)).fetchone()
        assert row is not None
        sent, sent_utc, err = _maybe_send_license_email(conn, row, force_retry=False)
        refreshed = conn.execute("SELECT * FROM orders WHERE token = ?", (token,)).fetchone()
        assert refreshed is not None
        out = _order_response_fields(refreshed, already_issued=False)
        out["email_sent"] = sent
        out["email_sent_utc"] = sent_utc
        out["email_error"] = err
        return out


@app.post("/activate")
def activate(body: ActivateBody) -> dict[str, Any]:
    token = (body.token or "").strip().upper().replace(" ", "")
    fp = (body.fingerprint_hex or "").strip().lower()
    expect_plan = _normalize_product(body.product)

    if len(fp) != 64 or any(c not in "0123456789abcdef" for c in fp):
        raise HTTPException(status_code=400, detail="fingerprint_hex non valido")

    now = _utcnow()

    with _db() as conn:
        migrate_db(conn)
        row = conn.execute("SELECT * FROM orders WHERE token = ?", (token,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="codice acquisto non trovato")

        if row["plan"] != expect_plan:
            raise HTTPException(
                status_code=400,
                detail=f"questo codice è per piano {row['plan']}, non per {expect_plan}",
            )

        exp = datetime.fromisoformat(row["expires_utc"])
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if now >= exp:
            raise HTTPException(status_code=403, detail="licenza scaduta")

        existing = conn.execute(
            "SELECT fingerprint_hex FROM activations WHERE token = ?",
            (token,),
        ).fetchall()
        fps = {(r["fingerprint_hex"] or "").lower() for r in existing}

        if fp in fps:
            return {
                "ok": True,
                "already_activated": True,
                "expires_utc": row["expires_utc"],
                "machines_count": len(fps),
                "max_machines": int(row["max_machines"]),
                "plan": row["plan"],
            }

        if len(fps) >= int(row["max_machines"]):
            raise HTTPException(
                status_code=403,
                detail=f"limite PC raggiunto ({row['max_machines']})",
            )

        conn.execute(
            "INSERT INTO activations(token, fingerprint_hex, activated_utc) VALUES (?,?,?)",
            (token, fp, _iso(now)),
        )
        machines_count = len(fps) + 1

    return {
        "ok": True,
        "already_activated": False,
        "expires_utc": row["expires_utc"],
        "machines_count": machines_count,
        "max_machines": int(row["max_machines"]),
        "plan": row["plan"],
    }


@app.get("/admin/order/{token}")
def admin_order(
    token: str,
    x_admin_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_admin(x_admin_key)
    token_n = token.strip().upper().replace(" ", "")
    with _db() as conn:
        migrate_db(conn)
        row = conn.execute("SELECT * FROM orders WHERE token = ?", (token_n,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="non trovato")
        acts = conn.execute(
            "SELECT fingerprint_hex, activated_utc FROM activations WHERE token = ?",
            (token_n,),
        ).fetchall()
    data = _order_response_fields(row)
    data["created_utc"] = row["created_utc"]
    data["activations"] = [dict(a) for a in acts]
    return data


@app.post("/admin/test-email")
def admin_test_email(
    body: TestEmailBody,
    x_admin_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_admin(x_admin_key)
    try:
        plan_id, _ = _normalize_plan(body.plan or "1pc")
    except HTTPException:
        plan_id = "1pc"

    try:
        send_test_email(to_address=str(body.email).strip(), plan_id=plan_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("SMTP error on test email")
        raise HTTPException(
            status_code=502,
            detail=f"Email send failed: {_safe_error_name(exc)}",
        ) from exc

    return {
        "ok": True,
        "message": f"Test email sent to {body.email}",
        "subject": "TEST configurazione email Palermo Business Agent",
        "license_created": False,
    }
