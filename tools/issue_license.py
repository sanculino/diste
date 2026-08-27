#!/usr/bin/env python3
"""
tools/issue_license.py
~~~~~~~~~~~~~~~~~~~~~~
Administrative CLI for Palermo Business Agent licenses.

Issue a license (calls local FastAPI logic / mailer):
    python tools/issue_license.py \\
        --plan 1pc \\
        --name "Mario Rossi" \\
        --email "mario@example.com" \\
        --payment-reference "PAYPAL-123"

Test email only (NO license, NO token, NO DB write):
    python tools/issue_license.py \\
        --test-email \\
        --email "mario@example.com" \\
        --plan 1pc
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "license_api"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / ".env")
load_dotenv()


def _issue_via_http(args: argparse.Namespace) -> int:
    """Prefer calling the running FastAPI admin endpoint when LICENSE_API_URL is set."""
    import urllib.error
    import urllib.request

    base = os.environ.get("LICENSE_API_URL", "").rstrip("/")
    admin_key = os.environ.get("LICENSE_ADMIN_KEY", "")
    if not base or not admin_key:
        return -1  # signal: fall back to local

    if args.test_email:
        url = f"{base}/admin/test-email"
        payload = {"email": args.email, "plan": args.plan}
    else:
        url = f"{base}/admin/issue"
        payload = {
            "plan": args.plan,
            "days": args.days,
            "note": args.note,
            "customer_name": args.name,
            "customer_email": args.email,
            "payment_reference": args.payment_reference,
        }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "X-Admin-Key": admin_key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        err = exc.read().decode("utf-8", errors="replace")
        print(f"ERROR HTTP {exc.code}: {err}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(body, indent=2, ensure_ascii=False))
    return 0


def _issue_local(args: argparse.Namespace) -> int:
    """Local path: use mailer (+ optional DB via FastAPI helpers) without HTTP."""
    from license_api.mailer import (  # noqa: WPS433
        plan_max_pc,
        plan_title,
        send_license_email,
        send_test_email,
    )

    if args.test_email:
        try:
            send_test_email(to_address=args.email, plan_id=args.plan)
        except Exception as exc:
            print(f"ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
            return 1
        print("Test email sent (no license created).")
        print("Subject: TEST configurazione email Palermo Business Agent")
        return 0

    # Local issue: write via FastAPI DB helpers
    from datetime import date, datetime, timedelta, timezone
    import secrets
    import string

    # Ensure DB init
    os.environ.setdefault(
        "LICENSE_DB_PATH",
        str(ROOT / "license_api" / "licenses.db"),
    )
    from license_api import app as api  # noqa: WPS433

    api.init_db()

    plan_id = args.plan
    if plan_id not in api.PLANS:
        print(f"ERROR: unknown plan {plan_id}", file=sys.stderr)
        return 1

    plan = api.PLANS[plan_id]
    chars = string.ascii_uppercase + string.digits
    segments = ["".join(secrets.choice(chars) for _ in range(4)) for _ in range(4)]
    token = f"{plan['token_prefix']}-{'-'.join(segments)}"
    expires = (date.today() + timedelta(days=args.days)).isoformat()
    created_at = datetime.now(timezone.utc).isoformat()

    with api._connect() as conn:
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
                args.days,
                expires,
                args.note,
                args.name,
                args.email,
                args.payment_reference,
                plan["max_machines"],
                created_at,
            ),
        )
        conn.commit()

    print(f"Token:   {token}")
    print(f"Plan:    {plan_title(plan_id)}")
    print(f"Expires: {expires}")
    print(f"Max PC:  {plan_max_pc(plan_id)}")
    print(f"Email:   {args.email}")
    print(f"PayRef:  {args.payment_reference or '-'}")

    try:
        send_license_email(
            to_address=args.email,
            client_name=args.name,
            plan_id=plan_id,
            token=token,
            expires=expires,
            max_pc=plan_max_pc(plan_id),
        )
    except Exception as exc:
        print(f"ERROR sending email: {type(exc).__name__}: {exc}", file=sys.stderr)
        print("License was created in DB; email failed.", file=sys.stderr)
        return 1

    print("Email sent successfully.")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Issue a PBA license or send a test email."
    )
    parser.add_argument(
        "--test-email",
        action="store_true",
        help="Send a configuration test email without creating a license",
    )
    parser.add_argument("--email", required=True, help="Customer / destination email")
    parser.add_argument("--name", default="Cliente", help="Customer name")
    parser.add_argument(
        "--plan",
        choices=["1pc", "3pc"],
        default="1pc",
        help="Plan id (default: 1pc)",
    )
    parser.add_argument("--days", type=int, default=365, help="License duration in days")
    parser.add_argument("--note", default=None, help="Optional note")
    parser.add_argument(
        "--payment-reference",
        default=None,
        help="Payment reference (e.g. PAYPAL-123)",
    )
    args = parser.parse_args()

    if not args.test_email and not args.email:
        parser.error("--email is required")

    code = _issue_via_http(args)
    if code >= 0:
        sys.exit(code)

    sys.exit(_issue_local(args))


if __name__ == "__main__":
    main()
