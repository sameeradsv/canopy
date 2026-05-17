from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime

EXPORT_FORMAT = "canopy-encrypted-export"
EXPORT_VERSION = 1
PBKDF2_ITERATIONS = 390_000


def _derive_key(passphrase: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac(
        "sha256",
        passphrase.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
        dklen=32,
    )


def _keystream(key: bytes, nonce: bytes, length: int) -> bytes:
    out = b""
    counter = 0
    while len(out) < length:
        out += hashlib.sha256(key + nonce + counter.to_bytes(4, "big")).digest()
        counter += 1
    return out[:length]


def _encrypt_bytes(plaintext: bytes, key: bytes) -> tuple[bytes, bytes, bytes]:
    nonce = secrets.token_bytes(16)
    stream = _keystream(key, nonce, len(plaintext))
    ciphertext = bytes(a ^ b for a, b in zip(plaintext, stream))
    mac = hmac.new(key, nonce + ciphertext, hashlib.sha256).digest()
    return nonce, ciphertext, mac


def _decrypt_bytes(nonce: bytes, ciphertext: bytes, mac: bytes, key: bytes) -> bytes:
    expected = hmac.new(key, nonce + ciphertext, hashlib.sha256).digest()
    if not hmac.compare_digest(expected, mac):
        raise ValueError("Export integrity check failed")
    stream = _keystream(key, nonce, len(ciphertext))
    return bytes(a ^ b for a, b in zip(ciphertext, stream))


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
    nonce, ciphertext, mac = _encrypt_bytes(plaintext, key)
    return {
        "format": EXPORT_FORMAT,
        "version": EXPORT_VERSION,
        "cipher": "xor-stream-sha256-hmac",
        "kdf": "pbkdf2-sha256",
        "iterations": PBKDF2_ITERATIONS,
        "salt": base64.b64encode(salt).decode("ascii"),
        "nonce": base64.b64encode(nonce).decode("ascii"),
        "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
        "mac": base64.b64encode(mac).decode("ascii"),
    }


def decrypt_export(blob: dict, passphrase: str) -> dict:
    if blob.get("format") != EXPORT_FORMAT:
        raise ValueError("Unrecognized export format")
    salt = base64.b64decode(blob["salt"])
    key = _derive_key(passphrase, salt)
    nonce = base64.b64decode(blob["nonce"])
    ciphertext = base64.b64decode(blob["ciphertext"])
    mac = base64.b64decode(blob["mac"])
    plaintext = _decrypt_bytes(nonce, ciphertext, mac, key)
    return json.loads(plaintext.decode("utf-8"))
