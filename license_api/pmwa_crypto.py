# -*- coding: utf-8 -*-
"""Ed25519 helpers for PM Web Agent license leases (server-side)."""

from __future__ import annotations

import base64
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _fmt(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_private_key() -> Ed25519PrivateKey:
    """Load Ed25519 private key — prefer LICENSE_ED25519_PRIVATE_KEY_PATH when set."""
    path_env = (os.environ.get("LICENSE_ED25519_PRIVATE_KEY_PATH") or "").strip()
    if path_env:
        path = Path(path_env)
        if not path.is_file():
            raise RuntimeError(f"Ed25519 private key not found: {path}")
        raw = path.read_bytes()
        if len(raw) != 32:
            raise RuntimeError("Private key file must be 32 raw Ed25519 bytes")
        return Ed25519PrivateKey.from_private_bytes(raw)

    hex_env = (os.environ.get("LICENSE_ED25519_PRIVATE_KEY_HEX") or "").strip()
    if hex_env:
        raw = bytes.fromhex(hex_env)
        if len(raw) != 32:
            raise RuntimeError("LICENSE_ED25519_PRIVATE_KEY_HEX must be 32 bytes hex")
        return Ed25519PrivateKey.from_private_bytes(raw)

    default_path = Path(__file__).resolve().parent.parent / "license_keys" / "PRIVATE_KEY_DO_NOT_DISTRIBUTE.raw"
    if default_path.is_file():
        raw = default_path.read_bytes()
        if len(raw) != 32:
            raise RuntimeError("Private key file must be 32 raw Ed25519 bytes")
        return Ed25519PrivateKey.from_private_bytes(raw)

    raise RuntimeError(
        "Ed25519 private key not configured. Set LICENSE_ED25519_PRIVATE_KEY_PATH or LICENSE_ED25519_PRIVATE_KEY_HEX"
    )


def sign_lease(payload: dict[str, Any], *, private_key: Ed25519PrivateKey | None = None) -> str:
    """Return PMWA2.<payload_b64url>.<sig_b64url>."""
    key = private_key or load_private_key()
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    sig = key.sign(body)
    return f"PMWA2.{_b64url_encode(body)}.{_b64url_encode(sig)}"


def build_lease_payload(
    *,
    license_id: str,
    edition: str,
    max_devices: int,
    device_fingerprint: str,
    expires_at: str,
    status: str = "active",
    offline_grace_days: int = 7,
    issued_at: str | None = None,
) -> dict[str, Any]:
    now = _utcnow()
    issued = issued_at or _fmt(now)
    grace_end = now + timedelta(days=int(offline_grace_days))
    # Offline ops allowed until min(license expiry, issued+grace) when last online was this issue
    try:
        exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    except ValueError:
        exp_dt = grace_end
    offline_until = min(grace_end, exp_dt)
    return {
        "v": 2,
        "product": "PMWA",
        "license_id": license_id,
        "edition": edition,
        "max_devices": int(max_devices),
        "device_fingerprint": device_fingerprint.lower(),
        "issued_at": issued,
        "expires_at": expires_at,
        "status": status,
        "offline_grace_until": _fmt(offline_until),
    }


def verify_lease_public(token: str, public_key_hex: str) -> dict[str, Any]:
    """Verify PMWA2 token with public key (usable in tests)."""
    parts = (token or "").strip().split(".")
    if len(parts) != 3 or parts[0] != "PMWA2":
        raise ValueError("invalid token format")
    pad = "=" * (-len(parts[1]) % 4)
    payload_bytes = base64.urlsafe_b64decode((parts[1] + pad).encode("ascii"))
    pad2 = "=" * (-len(parts[2]) % 4)
    sig = base64.urlsafe_b64decode((parts[2] + pad2).encode("ascii"))
    pub = Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key_hex))
    pub.verify(sig, payload_bytes)
    data = json.loads(payload_bytes.decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError("invalid payload")
    return data
