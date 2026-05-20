from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime

EXPORT_FORMAT = "canopy-encrypted-export"
EXPORT_VERSION = 2  # v1 = XOR-stream+HMAC (legacy), v2 = AES-GCM-256
PBKDF2_ITERATIONS = 390_000


def _derive_key(passphrase: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac(
        "sha256",
        passphrase.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
        dklen=32,
    )


# ---------------------------------------------------------------------------
# v2 — AES-GCM-256 (current)
# ---------------------------------------------------------------------------

def _encrypt_v2(plaintext: bytes, key: bytes) -> tuple[bytes, bytes]:
    from Crypto.Cipher import AES
    iv = secrets.token_bytes(12)
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext)
    return iv, ciphertext + tag  # tag appended (16 bytes)


def _decrypt_v2(blob: dict, passphrase: str) -> dict:
    from Crypto.Cipher import AES
    salt = base64.b64decode(blob["salt"])
    key = _derive_key(passphrase, salt)
    iv = base64.b64decode(blob["iv"])
    raw = base64.b64decode(blob["ciphertext"])
    ciphertext, tag = raw[:-16], raw[-16:]
    try:
        cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
        plaintext = cipher.decrypt_and_verify(ciphertext, tag)
    except (ValueError, KeyError) as exc:
        raise ValueError("Export integrity check failed") from exc
    return json.loads(plaintext.decode("utf-8"))


# ---------------------------------------------------------------------------
# v1 — XOR-stream + HMAC (backward-compat read-only)
# ---------------------------------------------------------------------------

def _keystream_v1(key: bytes, nonce: bytes, length: int) -> bytes:
    out = b""
    counter = 0
    while len(out) < length:
        out += hashlib.sha256(key + nonce + counter.to_bytes(4, "big")).digest()
        counter += 1
    return out[:length]


def _decrypt_v1(blob: dict, passphrase: str) -> dict:
    salt = base64.b64decode(blob["salt"])
    key = _derive_key(passphrase, salt)
    nonce = base64.b64decode(blob["nonce"])
    ciphertext = base64.b64decode(blob["ciphertext"])
    mac = base64.b64decode(blob["mac"])
    expected = hmac.new(key, nonce + ciphertext, hashlib.sha256).digest()
    if not hmac.compare_digest(expected, mac):
        raise ValueError("Export integrity check failed")
    stream = _keystream_v1(key, nonce, len(ciphertext))
    plaintext = bytes(a ^ b for a, b in zip(ciphertext, stream))
    return json.loads(plaintext.decode("utf-8"))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def encrypt_export(payload: dict, passphrase: str) -> dict:
    salt = secrets.token_bytes(16)
    key = _derive_key(passphrase, salt)
    inner = {
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "format": EXPORT_FORMAT,
        "version": EXPORT_VERSION,
        **payload,
    }
    plaintext = json.dumps(inner, default=str).encode("utf-8")
    iv, ciphertext = _encrypt_v2(plaintext, key)
    return {
        "format": EXPORT_FORMAT,
        "version": EXPORT_VERSION,
        "cipher": "aes-gcm-256",
        "kdf": "pbkdf2-sha256",
        "iterations": PBKDF2_ITERATIONS,
        "salt": base64.b64encode(salt).decode("ascii"),
        "iv": base64.b64encode(iv).decode("ascii"),
        "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
    }


def decrypt_export(blob: dict, passphrase: str) -> dict:
    if blob.get("format") != EXPORT_FORMAT:
        raise ValueError("Unrecognized export format")
    version = blob.get("version", 1)
    if version == 2:
        return _decrypt_v2(blob, passphrase)
    return _decrypt_v1(blob, passphrase)
