"""
license_api.mailer
~~~~~~~~~~~~~~~~~~
Sends license-delivery and configuration-test emails via SMTP.

Supports:
  - ssl      → smtplib.SMTP_SSL + ssl.create_default_context()  (Aruba :465)
  - starttls → SMTP + starttls
  - none     → plain SMTP (local/dev only)

Credentials are read exclusively from environment variables.
"""

from __future__ import annotations

import html
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from typing import Literal

logger = logging.getLogger(__name__)

DOWNLOAD_LINKS: dict[str, str] = {
    "1pc": "https://distemanagementsoftware.it/downloads/PalermoBusinessAgent_Setup_1PC_1Y.zip",
    "3pc": "https://distemanagementsoftware.it/downloads/PalermoBusinessAgent_Setup_3PC_1Y.zip",
}

PLAN_TITLES: dict[str, str] = {
    "1pc": "Licenza 1 PC / 1 anno",
    "3pc": "Licenza fino a 3 PC / 1 anno",
}

PLAN_MAX_PC: dict[str, int] = {
    "1pc": 1,
    "3pc": 3,
}

TEST_EMAIL_SUBJECT = "TEST configurazione email Palermo Business Agent"


def download_link(plan_id: str) -> str:
    return DOWNLOAD_LINKS.get(plan_id, DOWNLOAD_LINKS["1pc"])


def plan_title(plan_id: str) -> str:
    return PLAN_TITLES.get(plan_id, plan_id)


def plan_max_pc(plan_id: str) -> int:
    return PLAN_MAX_PC.get(plan_id, 1)


def _esc(value: str) -> str:
    """Escape user-controlled values for plain-text and HTML email bodies."""
    return html.escape(str(value or ""), quote=True)


def _safe_subject_part(value: str, max_len: int = 120) -> str:
    s = str(value or "").replace("\r", "").replace("\n", " ").strip()
    return s[:max_len]


def _smtp_config() -> dict:
    host = os.environ.get("SMTP_HOST", "")
    port = int(os.environ.get("SMTP_PORT", "465"))
    username = os.environ.get("SMTP_USERNAME", "")
    password = os.environ.get("SMTP_PASSWORD", "")
    security: str = os.environ.get("SMTP_SECURITY", "ssl").lower()

    if not host or not username or not password:
        raise RuntimeError(
            "SMTP credentials are missing. "
            "Set SMTP_HOST, SMTP_USERNAME and SMTP_PASSWORD."
        )

    return {
        "host": host,
        "port": port,
        "username": username,
        "password": password,
        "security": security,
    }


def _from_config() -> tuple[str, str, str]:
    name = os.environ.get("MAIL_FROM_NAME", "DI.S.TE. MANAGEMENT Software")
    address = os.environ.get("MAIL_FROM_ADDRESS", "noreply@example.com")
    reply_to = os.environ.get("MAIL_REPLY_TO", address)
    return name, address, reply_to


def _build_text(
    client_name: str,
    plan_title_str: str,
    token: str,
    expires: str,
    max_pc: int,
    download_url: str,
) -> str:
    return f"""\
Gentile {client_name},

grazie per aver scelto Palermo Business Agent.
Di seguito i dettagli della tua licenza.

  Piano:               {plan_title_str}
  Codice attivazione:  {token}
  Scadenza:            {expires}
  PC autorizzati:      {max_pc}

Download:
  {download_url}

=== Istruzioni di attivazione ===
1. Scarica e installa il setup dal link qui sopra.
2. Al primo avvio inserisci il codice di attivazione.
3. L'attivazione legherà la licenza a questo PC.

ATTENZIONE: non condividere il codice di attivazione con terzi.
Ogni codice è personale e collegato al tuo acquisto.

Per qualsiasi domanda rispondi a questa email.

Cordiali saluti,
DI.S.TE. MANAGEMENT Software
"""


def _build_html(
    client_name: str,
    plan_title_str: str,
    token: str,
    expires: str,
    max_pc: int,
    download_url: str,
) -> str:
    return f"""\
<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#f8fafc;color:#0f2744;">
  <div style="max-width:600px;margin:24px auto;background:#ffffff;border-radius:12px;
              border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#0b4f8c,#1fa3a0);padding:28px 32px;">
      <h1 style="margin:0;font-size:22px;color:#fff;">Palermo Business Agent</h1>
      <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,.85);">
        Licenza attivata con successo
      </p>
    </div>
    <div style="padding:28px 32px;">
      <p style="font-size:15px;">Gentile <strong>{_esc(client_name)}</strong>,</p>
      <p style="font-size:15px;">grazie per aver scelto Palermo Business Agent.
         Ecco i dettagli della tua licenza:</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <tr>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Piano</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;">{_esc(plan_title_str)}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Codice attivazione</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;">
            <code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;font-size:15px;
                         letter-spacing:1px;font-weight:700;">{_esc(token)}</code>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Scadenza</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;">{_esc(expires)}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">PC autorizzati</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;">{max_pc}</td>
        </tr>
      </table>
      <p style="margin:24px 0 12px;font-size:15px;font-weight:600;">Download:</p>
      <a href="{_esc(download_url)}"
         style="display:inline-block;padding:12px 24px;border-radius:8px;font-size:14px;
                font-weight:700;color:#fff;background:linear-gradient(135deg,#0b4f8c,#1fa3a0);
                text-decoration:none;">
        Scarica il setup
      </a>
      <div style="margin:28px 0 0;padding:16px;background:#f8fafc;border-radius:8px;
                  border:1px solid #e2e8f0;">
        <p style="margin:0 0 8px;font-size:14px;font-weight:700;">Istruzioni di attivazione</p>
        <ol style="margin:0;padding:0 0 0 18px;font-size:14px;line-height:1.6;">
          <li>Scarica e installa il setup dal link qui sopra.</li>
          <li>Al primo avvio inserisci il codice di attivazione.</li>
          <li>L&rsquo;attivazione legher&agrave; la licenza a questo PC.</li>
        </ol>
      </div>
      <div style="margin:20px 0 0;padding:12px 16px;background:#fff7ed;border-radius:8px;
                  border:1px solid #fed7aa;">
        <p style="margin:0;font-size:13px;color:#9a3412;">
          <strong>Non condividere il codice di attivazione.</strong>
          &Egrave; personale e collegato al tuo acquisto.
        </p>
      </div>
    </div>
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;
                font-size:12px;color:#64748b;text-align:center;">
      DI.S.TE. MANAGEMENT S.a.s.
    </div>
  </div>
</body>
</html>"""


def send_license_email(
    *,
    to_address: str,
    client_name: str,
    plan_id: str,
    plan_title_str: str | None = None,
    token: str,
    expires: str,
    max_pc: int | None = None,
) -> None:
    """Build and send the license delivery email (text + HTML)."""
    from_name, from_address, reply_to = _from_config()
    smtp = _smtp_config()
    title = plan_title_str or plan_title(plan_id)
    pcs = max_pc if max_pc is not None else plan_max_pc(plan_id)
    url = download_link(plan_id)

    msg = EmailMessage()
    msg["Subject"] = f"Palermo Business Agent — La tua licenza ({title})"
    msg["From"] = f"{from_name} <{from_address}>"
    msg["To"] = to_address
    msg["Reply-To"] = reply_to

    msg.set_content(_build_text(_esc(client_name), title, token, expires, pcs, url))
    msg.add_alternative(
        _build_html(_esc(client_name), _esc(title), _esc(token), _esc(expires), pcs, _esc(url)),
        subtype="html",
    )

    _send(msg, smtp)

    logger.info(
        "License email sent to=%s plan=%s token_prefix=%s…",
        to_address,
        plan_id,
        token[:6] if token else "",
    )


def send_test_email(*, to_address: str, plan_id: str = "1pc") -> None:
    """
    Send a configuration test email.
    Does NOT create a license, token, or database row.
    """
    from_name, from_address, reply_to = _from_config()
    smtp = _smtp_config()
    title = plan_title(plan_id)
    url = download_link(plan_id)

    text = f"""\
Questo è un messaggio di TEST della configurazione email
per Palermo Business Agent.

Piano di riferimento (solo test): {title}
Link download atteso: {url}

Nessuna licenza è stata creata.
Nessun token è stato generato.
Nessuna riga è stata scritta nel database.

Se ricevi questa email, SMTP Aruba funziona correttamente.
"""

    html = f"""\
<!DOCTYPE html>
<html lang="it"><body style="font-family:system-ui,sans-serif;color:#0f2744;">
  <h2>{TEST_EMAIL_SUBJECT}</h2>
  <p>Questo è un messaggio di <strong>TEST</strong> della configurazione email.</p>
  <ul>
    <li>Piano di riferimento (solo test): {title}</li>
    <li>Link download atteso: <a href="{url}">{url}</a></li>
  </ul>
  <p><em>Nessuna licenza, token o riga database è stata creata.</em></p>
</body></html>"""

    msg = EmailMessage()
    msg["Subject"] = TEST_EMAIL_SUBJECT
    msg["From"] = f"{from_name} <{from_address}>"
    msg["To"] = to_address
    msg["Reply-To"] = reply_to
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    _send(msg, smtp)
    logger.info("Test email sent to=%s plan=%s", to_address, plan_id)


def send_pmwa_order_confirmation(
    *,
    to_address: str,
    order_id: str,
    plan_id: str,
    download_url: str,
    success_url: str,
    locale: str = "it",
) -> None:
    """Post-payment order confirmation — no manual license code in normal flow."""
    smtp = _smtp_config()
    from_name, from_address, reply_to = _from_config()
    title = plan_title(plan_id)
    safe_order = _safe_subject_part(order_id)
    safe_license = _safe_subject_part(license_id)
    if locale == "en":
        subject = f"PM Web Agent — Order confirmed ({safe_order})"
        text = f"""Thank you for your purchase.

Plan: {_esc(title)}
License duration: 12 months
Order ID: {_esc(order_id)}

Download installer (protected link):
{_esc(download_url)}

Order page:
{_esc(success_url)}

After installation, open PM Web Agent and enter your purchase email and order reference.
The application activates automatically on first launch.

DI.S.TE. MANAGEMENT"""
    else:
        subject = f"PM Web Agent — Ordine confermato ({safe_order})"
        text = f"""Grazie per l'acquisto.

Piano: {_esc(title)}
Durata licenza: 12 mesi
Codice ordine: {_esc(order_id)}

Scarica l'installer (link protetto):
{_esc(download_url)}

Pagina ordine:
{_esc(success_url)}

Dopo l'installazione, apri PM Web Agent e inserisci email e riferimento ordine.
L'applicazione si attiva automaticamente al primo avvio.

DI.S.TE. MANAGEMENT"""

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_address}>"
    msg["To"] = to_address
    msg["Reply-To"] = reply_to
    msg.set_content(text)
    _send(msg, smtp)
    logger.info("PMWA order email sent to=%s order=%s", to_address, order_id)


def send_pmwa_renewal_confirmation(
    *,
    to_address: str,
    order_id: str,
    license_id: str,
    plan_id: str,
    success_url: str,
    locale: str = "it",
) -> None:
    """Post-renewal confirmation — no new activation code or reinstall required."""
    smtp = _smtp_config()
    from_name, from_address, reply_to = _from_config()
    title = plan_title(plan_id)
    safe_order = _safe_subject_part(order_id)
    safe_license = _safe_subject_part(license_id)
    if locale == "en":
        subject = f"PM Web Agent — License renewed ({safe_order})"
        text = f"""Your PM Web Agent license has been extended by 12 months.

Plan: {_esc(title)}
License ID: {_esc(license_id)}
Order ID: {_esc(order_id)}

No new activation code is required. Your existing installation will pick up the new expiry on the next online validation.

Order page:
{_esc(success_url)}

DI.S.TE. MANAGEMENT"""
    else:
        subject = f"PM Web Agent — Licenza rinnovata ({safe_order})"
        text = f"""La tua licenza PM Web Agent è stata estesa di 12 mesi.

Piano: {_esc(title)}
ID licenza: {_esc(license_id)}
Codice ordine: {_esc(order_id)}

Non serve un nuovo codice di attivazione. L'installazione esistente rileverà la nuova scadenza alla prossima validazione online.

Pagina ordine:
{_esc(success_url)}

DI.S.TE. MANAGEMENT"""

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_address}>"
    msg["To"] = to_address
    msg["Reply-To"] = reply_to
    msg.set_content(text)
    _send(msg, smtp)
    logger.info("PMWA renewal email sent to=%s order=%s license=%s", to_address, order_id, license_id)


SecurityMode = Literal["ssl", "starttls", "none"]


def _send(msg: EmailMessage, smtp: dict) -> None:
    security: SecurityMode = smtp["security"]

    if security == "ssl":
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(smtp["host"], smtp["port"], context=ctx) as server:
            server.login(smtp["username"], smtp["password"])
            server.send_message(msg)

    elif security == "starttls":
        ctx = ssl.create_default_context()
        with smtplib.SMTP(smtp["host"], smtp["port"]) as server:
            server.starttls(context=ctx)
            server.login(smtp["username"], smtp["password"])
            server.send_message(msg)

    elif security == "none":
        with smtplib.SMTP(smtp["host"], smtp["port"]) as server:
            server.login(smtp["username"], smtp["password"])
            server.send_message(msg)

    else:
        raise ValueError(f"Unknown SMTP_SECURITY value: {security!r}")
