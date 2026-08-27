"""
Tests for license_api (FastAPI + mailer).
All SMTP interactions are mocked — no real credentials required.
"""

from __future__ import annotations

import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path
from unittest import mock

import pytest
from fastapi.testclient import TestClient

_TEST_ENV = {
    "MAIL_FROM_NAME": "Test Sender",
    "MAIL_FROM_ADDRESS": "test@example.com",
    "MAIL_REPLY_TO": "reply@example.com",
    "SMTP_HOST": "smtps.aruba.it",
    "SMTP_PORT": "465",
    "SMTP_USERNAME": "test@example.com",
    "SMTP_PASSWORD": "s3cret-pass",
    "SMTP_SECURITY": "ssl",
    "LICENSE_ADMIN_KEY": "test-admin-key",
}

_SEND_KWARGS = dict(
    to_address="cliente@example.com",
    client_name="Mario Rossi",
    plan_id="1pc",
    token="NCC1-AAAA-BBBB-CCCC-DDDD",
    expires="2027-07-29",
    max_pc=1,
)


@pytest.fixture()
def env(monkeypatch, tmp_path):
    for k, v in _TEST_ENV.items():
        monkeypatch.setenv(k, v)
    db = tmp_path / "test_licenses.db"
    monkeypatch.setenv("LICENSE_DB_PATH", str(db))
    return db


@pytest.fixture()
def client(env):
    # Import after env is set so DB path is picked up
    import importlib
    import license_api.app as api

    importlib.reload(api)
    api.init_db()
    with TestClient(api.app) as c:
        yield c, api


# ── Architecture checks ─────────────────────────────────────────────


def test_api_is_fastapi_not_flask():
    """API must be FastAPI; Flask must not be used."""
    from license_api import app as api
    from fastapi import FastAPI

    assert isinstance(api.app, FastAPI)
    src = Path(api.__file__).read_text(encoding="utf-8")
    assert "flask" not in src.lower()
    assert "5050" not in src
    assert 'if __name__ == "__main__"' not in src or "5050" not in src


def test_no_flask_in_requirements():
    req = Path("license_api/requirements.txt").read_text(encoding="utf-8").lower()
    assert "flask" not in req
    assert "fastapi" in req
    assert "uvicorn" in req


def test_no_port_5050_in_project():
    for path in Path("license_api").rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        assert "5050" not in text, f"Found 5050 in {path}"
    cli = Path("tools/issue_license.py").read_text(encoding="utf-8")
    assert "5050" not in cli
    assert "--test-email" in cli
    assert "--test " not in cli.replace("--test-email", "")


# ── Existing endpoints ───────────────────────────────────────────────


def test_health(client):
    c, _ = client
    r = c.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_admin_issue_requires_key(client):
    c, _ = client
    r = c.post("/admin/issue", json={"plan": "1pc"})
    assert r.status_code == 401


def test_admin_order_requires_key(client):
    c, _ = client
    r = c.get("/admin/order/NCC1-XXXX")
    assert r.status_code == 401


def test_admin_test_email_requires_key(client):
    c, _ = client
    r = c.post("/admin/test-email", json={"email": "a@b.co", "plan": "1pc"})
    assert r.status_code == 401


def test_issue_and_order_and_activate(client, monkeypatch):
    c, api = client
    headers = {"X-Admin-Key": _TEST_ENV["LICENSE_ADMIN_KEY"]}

    with mock.patch.object(api, "send_license_email") as send_mock:
        r = c.post(
            "/admin/issue",
            headers=headers,
            json={
                "plan": "1pc",
                "days": 365,
                "note": "test",
                "customer_name": "Mario Rossi",
                "customer_email": "mario@example.com",
                "payment_reference": "PAYPAL-123",
            },
        )
    assert r.status_code == 200
    data = r.json()
    assert data["plan"] == "1pc"
    assert data["token"].startswith("NCC1-")
    assert data["email_sent"] is True
    assert data["payment_reference"] == "PAYPAL-123"
    send_mock.assert_called_once()

    token = data["token"]
    r2 = c.get(f"/admin/order/{token}", headers=headers)
    assert r2.status_code == 200
    assert r2.json()["token"] == token
    assert r2.json()["customer_email"] == "mario@example.com"

    fp = "a" * 64
    r3 = c.post(
        "/activate",
        json={"token": token, "fingerprint_hex": fp, "product": "one_pc_1y_paypal"},
    )
    assert r3.status_code == 200
    assert r3.json()["ok"] is True
    assert r3.json()["already_activated"] is False

    r4 = c.post(
        "/activate",
        json={"token": token, "fingerprint_hex": fp, "product": "one_pc_1y_paypal"},
    )
    assert r4.status_code == 200
    assert r4.json()["already_activated"] is True


def test_issue_smtp_error_logged_without_password(client, caplog, monkeypatch):
    c, api = client
    headers = {"X-Admin-Key": _TEST_ENV["LICENSE_ADMIN_KEY"]}

    with mock.patch.object(
        api, "send_license_email", side_effect=smtplib.SMTPException("relay denied")
    ):
        with caplog.at_level(logging.ERROR):
            r = c.post(
                "/admin/issue",
                headers=headers,
                json={
                    "plan": "3pc",
                    "customer_name": "Luigi",
                    "customer_email": "luigi@example.com",
                },
            )

    assert r.status_code == 200
    body = r.json()
    assert body["token"].startswith("NCC3-")
    assert body["email_sent"] is False
    assert body["email_error"] == "SMTPException"
    assert "s3cret-pass" not in caplog.text
    assert _TEST_ENV["SMTP_PASSWORD"] not in caplog.text


def test_admin_test_email_no_license(client, monkeypatch):
    c, api = client
    headers = {"X-Admin-Key": _TEST_ENV["LICENSE_ADMIN_KEY"]}

    with mock.patch.object(api, "send_test_email") as send_mock:
        r = c.post(
            "/admin/test-email",
            headers=headers,
            json={"email": "test@example.com", "plan": "1pc"},
        )

    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["license_created"] is False
    assert data["subject"] == "TEST configurazione email Palermo Business Agent"
    send_mock.assert_called_once()

    with api._db() as conn:
        n = conn.execute("SELECT COUNT(*) AS n FROM orders").fetchone()["n"]
    assert n == 0


# ── Mailer unit tests ────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _clean_mail_env(monkeypatch):
    for key in list(_TEST_ENV):
        if key.startswith(("MAIL_", "SMTP_")):
            monkeypatch.delenv(key, raising=False)


def test_ssl_uses_smtp_ssl(monkeypatch):
    for k, v in _TEST_ENV.items():
        if k.startswith(("MAIL_", "SMTP_")):
            monkeypatch.setenv(k, v)

    mock_ssl = mock.MagicMock(name="SMTP_SSL")
    with mock.patch("license_api.mailer.smtplib.SMTP_SSL", mock_ssl):
        from license_api.mailer import send_license_email

        send_license_email(**_SEND_KWARGS)

    mock_ssl.assert_called_once()
    args, kwargs = mock_ssl.call_args
    assert args[0] == "smtps.aruba.it"
    assert args[1] == 465
    ctx = kwargs.get("context") or (args[2] if len(args) > 2 else None)
    assert isinstance(ctx, ssl.SSLContext)


def test_login_is_called(monkeypatch):
    for k, v in _TEST_ENV.items():
        if k.startswith(("MAIL_", "SMTP_")):
            monkeypatch.setenv(k, v)

    mock_ssl = mock.MagicMock(name="SMTP_SSL")
    mock_server = mock_ssl.return_value.__enter__.return_value
    with mock.patch("license_api.mailer.smtplib.SMTP_SSL", mock_ssl):
        from license_api.mailer import send_license_email

        send_license_email(**_SEND_KWARGS)

    mock_server.login.assert_called_once_with("test@example.com", "s3cret-pass")


def test_send_message_called(monkeypatch):
    for k, v in _TEST_ENV.items():
        if k.startswith(("MAIL_", "SMTP_")):
            monkeypatch.setenv(k, v)

    mock_ssl = mock.MagicMock(name="SMTP_SSL")
    mock_server = mock_ssl.return_value.__enter__.return_value
    with mock.patch("license_api.mailer.smtplib.SMTP_SSL", mock_ssl):
        from license_api.mailer import send_license_email

        send_license_email(**_SEND_KWARGS)

    mock_server.send_message.assert_called_once()
    sent = mock_server.send_message.call_args[0][0]
    assert isinstance(sent, EmailMessage)
    assert "cliente@example.com" in sent["To"]
    assert sent["Reply-To"] == "reply@example.com"


def test_missing_password_raises(monkeypatch):
    for k, v in _TEST_ENV.items():
        if k.startswith(("MAIL_", "SMTP_")) and k != "SMTP_PASSWORD":
            monkeypatch.setenv(k, v)

    from license_api.mailer import send_license_email

    with pytest.raises(RuntimeError, match="SMTP credentials are missing"):
        send_license_email(**_SEND_KWARGS)


def test_smtp_error_propagates(monkeypatch):
    for k, v in _TEST_ENV.items():
        if k.startswith(("MAIL_", "SMTP_")):
            monkeypatch.setenv(k, v)

    mock_ssl = mock.MagicMock(name="SMTP_SSL")
    mock_server = mock_ssl.return_value.__enter__.return_value
    mock_server.send_message.side_effect = smtplib.SMTPException("relay denied")

    with mock.patch("license_api.mailer.smtplib.SMTP_SSL", mock_ssl):
        from license_api.mailer import send_license_email

        with pytest.raises(smtplib.SMTPException, match="relay denied"):
            send_license_email(**_SEND_KWARGS)


def test_no_credentials_in_logs(monkeypatch, caplog):
    for k, v in _TEST_ENV.items():
        if k.startswith(("MAIL_", "SMTP_")):
            monkeypatch.setenv(k, v)

    mock_ssl = mock.MagicMock(name="SMTP_SSL")
    with caplog.at_level(logging.DEBUG, logger="license_api.mailer"):
        with mock.patch("license_api.mailer.smtplib.SMTP_SSL", mock_ssl):
            from license_api.mailer import send_license_email

            send_license_email(**_SEND_KWARGS)

    assert "s3cret-pass" not in caplog.text


def test_download_link_1pc(monkeypatch):
    for k, v in _TEST_ENV.items():
        if k.startswith(("MAIL_", "SMTP_")):
            monkeypatch.setenv(k, v)

    mock_ssl = mock.MagicMock(name="SMTP_SSL")
    mock_server = mock_ssl.return_value.__enter__.return_value
    with mock.patch("license_api.mailer.smtplib.SMTP_SSL", mock_ssl):
        from license_api.mailer import send_license_email

        send_license_email(**_SEND_KWARGS)

    body = mock_server.send_message.call_args[0][0].get_body(
        preferencelist=("plain",)
    ).get_content()
    assert "PalermoBusinessAgent_Setup_1PC_1Y.zip" in body
    assert "PalermoBusinessAgent_Setup_3PC_1Y.zip" not in body


def test_download_link_3pc(monkeypatch):
    for k, v in _TEST_ENV.items():
        if k.startswith(("MAIL_", "SMTP_")):
            monkeypatch.setenv(k, v)

    mock_ssl = mock.MagicMock(name="SMTP_SSL")
    mock_server = mock_ssl.return_value.__enter__.return_value
    kwargs = {**_SEND_KWARGS, "plan_id": "3pc", "max_pc": 3}
    with mock.patch("license_api.mailer.smtplib.SMTP_SSL", mock_ssl):
        from license_api.mailer import send_license_email

        send_license_email(**kwargs)

    body = mock_server.send_message.call_args[0][0].get_body(
        preferencelist=("plain",)
    ).get_content()
    assert "PalermoBusinessAgent_Setup_3PC_1Y.zip" in body


def test_test_email_subject_and_no_token(monkeypatch):
    for k, v in _TEST_ENV.items():
        if k.startswith(("MAIL_", "SMTP_")):
            monkeypatch.setenv(k, v)

    mock_ssl = mock.MagicMock(name="SMTP_SSL")
    mock_server = mock_ssl.return_value.__enter__.return_value
    with mock.patch("license_api.mailer.smtplib.SMTP_SSL", mock_ssl):
        from license_api.mailer import TEST_EMAIL_SUBJECT, send_test_email

        send_test_email(to_address="mario@example.com", plan_id="1pc")

    sent = mock_server.send_message.call_args[0][0]
    assert sent["Subject"] == TEST_EMAIL_SUBJECT
    assert sent["Subject"] == "TEST configurazione email Palermo Business Agent"
    body = sent.get_body(preferencelist=("plain",)).get_content()
    assert "Nessuna licenza" in body or "nessuna licenza" in body.lower()
    assert "NCC1-" not in body or "TEST" in sent["Subject"]


def test_html_email_escapes_client_name(monkeypatch):
    """User-controlled client_name must not inject HTML into license email."""
    for k, v in _TEST_ENV.items():
        if k.startswith(("MAIL_", "SMTP_")):
            monkeypatch.setenv(k, v)

    mock_ssl = mock.MagicMock(name="SMTP_SSL")
    mock_server = mock_ssl.return_value.__enter__.return_value
    xss_name = '<script>alert("x")</script>Mario'
    with mock.patch("license_api.mailer.smtplib.SMTP_SSL", mock_ssl):
        from license_api.mailer import send_license_email

        send_license_email(**{**_SEND_KWARGS, "client_name": xss_name})

    sent = mock_server.send_message.call_args[0][0]
    html = sent.get_body(preferencelist=("html",)).get_content()
    assert "<script>" not in html
    assert "onerror=" not in html.lower()
    assert "Mario" in html
